// VOIDSTEP — a fighter goes UNDER the board and comes up somewhere else.
//
// Shared by 4 cards: M199 Drop Shadow, M200 Null Gate, M204 Avatar's Burden,
// M207 Shadow Bolt. All four are Void-deck cards and all four describe the
// same picture: not around the board and not through it, UNDERNEATH it.
//
// THE WHOLE EFFECT LIVES AT FLAGSTONE HEIGHT, and that is the design. Cards
// lie at y≈0.21 and write depth; anything flat at y≈0.10 simply fails the
// depth test where a card covers it, so a shape running across the stones is
// really, physically hidden as it passes beneath one and reappears on the far
// side. Every other motif on this table has to fight that rule — the note
// everywhere else is "lift it +0.055 or it only draws on the stone AROUND the
// card". This is the one motif that WANTS to be occluded, so nothing here is
// ever lifted onto a card face. It also means the darkness never touches the
// card's art: the square around a fighter goes black and the fighter stays
// lit, which is the opposite picture from possess.js (a card-shaped slab of
// black laid ON a fighter) and cannot be confused with it at sixty pixels.
//
// IT GOES SOMEWHERE. The Void is a real object out to the left of the board
// at square 9 — a black vortex with blue and purple arms — so the passage is
// routed to it and back rather than merely borrowing its colours: the shadow
// pours out from under the card, slinks across the flagstones, dives into the
// Void, and something comes back out. The return is fast where the departure
// is slow, which is what stops a round trip reading as "nothing happened".
//
// The Void's own palette is taken from board.js `spiralTexture` — blue at the
// throat (96,170,255), purple between (126,86,240) — and its spill light is
// 0x7a4cf0. Using those exact values is what makes the passage and the pit
// look like one piece of magic.
//
// CONTRAST IS BOUGHT WITH SHADOW. ACES turns overlapping additive halos
// white, so nothing here is a glowing body. The stone is darkened first, and
// the only light in the motif is two cold hairlines running down the SIDES of
// the dark — light does not come off a shadow, but it does come out of the
// crack the shadow is under, and the eye reads the gap between the two lines
// as something forcing the stones apart.
//
// Preview:  node tools/shot.js --wait 9000 --settle 800 \
//   --url "game/?quick=1&seed=5&p0=The%20Voidbringers&t=520" \
//   --eval tools/fxdemo/voidstep.js --out /tmp/vs.png
// The DECK MATTERS: board.js only draws the pit for a deck that mentions it,
// and ?p0= falls back to the first deck in the list, silently, when the name
// does not match — so a typo there costs you the far end of the effect with
// nothing on screen to say so. `?exit=1` plays the Drop Shadow leaving, and
// `?sq=` moves the fighter, which is how the diagonal runs get checked.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';

/* ---------------------------------------------------------------- colour */

// Light coming UP through a crack, not the shadow's own colour. Washed most of
// the way to white with the blue held above the red so it reads cold; at the
// Void's flat violet the hairline looked like another piece of the shadow
// lying on the stone rather than like something lit from below it.
const COLD = 0xbcd4ff;
const VIOLET = 0x7a4cf0;   // the Void's own spill light, from board.js

/* --------------------------------------------------------------- heights */

// The flagstone face is 0.080 and a card's slab runs 0.185 to 0.220, so this
// has a 10cm window to live in and it has to be near the TOP of it.
//
// At 0.092 — a centimetre over the stone, which is where the first cut put it
// so that the dark would hug the floor — the big flat pool simply did not
// draw, anywhere, while the thin ribbon four millimetres above it did. Two
// full passes were spent hunting a texture that turned out to be correct:
// with depthTest switched off the pool appeared instantly, so nothing was
// wrong with it except that the depth buffer at this camera cannot separate a
// centimetre. Four centimetres up it draws reliably, and is still seven under
// the card, so the passage is occluded by the cards exactly as the motif
// needs. Paint a suspect decal BRIGHT RED to find it — but tinting proves
// nothing when the map itself is black, as this one's is; the red test only
// became useful once the colour came from the material and not the map.
const STONE = 0.118;

/* -------------------------------------------------------------- textures */

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
 * The body of the runner, painted as a mask: x runs from the TAIL (0) to the
 * HEAD (1), y across it.
 *
 * The silhouette is in the geometry, so all this does is thin the tail out and
 * feather the sides. A body of even weight from end to end read as a painted
 * stripe with a start; thinned toward the tail it reads as a thing whose back
 * end is still somewhere else.
 */
const bodyTex = () => tex('vs-body', (g, W, H) => {
  const along = g.createLinearGradient(0, 0, W, 0);
  along.addColorStop(0.00, 'rgba(255,255,255,0)');
  along.addColorStop(0.14, 'rgba(255,255,255,0.55)');
  along.addColorStop(0.45, 'rgba(255,255,255,0.92)');
  along.addColorStop(0.90, 'rgba(255,255,255,1)');
  along.addColorStop(1.00, 'rgba(255,255,255,0.9)');
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
  const across = g.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.20, 'rgba(0,0,0,0.70)');
  across.addColorStop(0.38, 'rgba(0,0,0,1)');
  across.addColorStop(0.62, 'rgba(0,0,0,1)');
  across.addColorStop(0.80, 'rgba(0,0,0,0.70)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
}, 256, 64);

/**
 * The dark under a square whose fighter has gone: near-black over a plateau
 * and then a long feathered skirt.
 *
 * NOT a blobTexture. The kit's blob is a straight radial ramp from its centre
 * to its edge, and a card covers the middle of it — so everything that
 * actually showed was the outer half of the ramp, alpha 0.4 falling to 0, and
 * at sixty pixels the square simply did not look any darker. Three shots were
 * spent believing the pool was not being drawn at all; it was, and painting it
 * bright red proved it. The fix is a plateau that survives out past the card's
 * corners before it starts to fall.
 */
const wellTex = () => tex('vs-well', (g, W, H) => {
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0.00, 'rgba(2,0,7,0.97)');
  grd.addColorStop(0.44, 'rgba(2,0,7,0.95)');
  grd.addColorStop(0.60, 'rgba(4,1,12,0.78)');
  grd.addColorStop(0.78, 'rgba(7,2,20,0.36)');
  grd.addColorStop(1.00, 'rgba(10,4,28,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 256, 256);

/**
 * The haze's own profile: no plateau and no shoulders, just a long falloff
 * either side.
 *
 * It started out sharing the body's map, which has a flat top and a quick edge
 * so that the shadow has a silhouette — and two tiles' worth of that laid
 * across the flagstones read as a rubber mat someone had put down. What the
 * underside of a floor does is darken and then stop darkening.
 */
const hazeTex = () => tex('vs-haze', (g, W, H) => {
  const along = g.createLinearGradient(0, 0, W, 0);
  along.addColorStop(0.00, 'rgba(255,255,255,0)');
  along.addColorStop(0.30, 'rgba(255,255,255,0.55)');
  along.addColorStop(0.72, 'rgba(255,255,255,1)');
  along.addColorStop(1.00, 'rgba(255,255,255,0.92)');
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
  const across = g.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.22, 'rgba(0,0,0,0.34)');
  across.addColorStop(0.50, 'rgba(0,0,0,1)');
  across.addColorStop(0.78, 'rgba(0,0,0,0.34)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
}, 256, 64);

/**
 * The crest: the hairline of cold light riding the head of the runner.
 *
 * A BOW WAVE, not a headlight. Drawn as an arc that is brightest at its middle
 * and dies at both tips, so what the eye gets is the lit front edge of
 * something pushing up under the stone. A round blob here made the runner a
 * glowing pellet skating over the flagstones — on top of the board, which is
 * the one thing this motif must not say.
 */
const crestTex = () => tex('vs-crest', (g, W, H) => {
  const cx = W * 0.5, cy = H * 1.42, r = H * 1.06;
  const pass = (width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, r, Math.PI * 1.22, Math.PI * 1.78);
    g.stroke();
  };
  // three passes, wide and faint down to narrow and hot: one stroke of one
  // width is a drawn line, light on an edge has a falloff either side of it
  pass(H * 0.52, 0.12, H * 0.16);
  pass(H * 0.20, 0.38, H * 0.06);
  pass(H * 0.060, 1.0, H * 0.012);
  g.filter = 'none';
  const across = g.createLinearGradient(0, 0, W, 0);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.30, 'rgba(0,0,0,1)');
  across.addColorStop(0.70, 'rgba(0,0,0,1)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
}, 192, 64);

/**
 * The light leaking along the runner's two long edges.
 *
 * This is what made the passage legible. A black ribbon crossing dark
 * flagstones is nothing at the size a square really is on screen — three
 * passes of shots showed a runner the debugger swore was there at opacity
 * 0.96 and which simply could not be found in the picture. Light does not
 * come off a shadow, but it does come out of the CRACK the shadow is under,
 * so two cold hairlines are run down the sides of the body: the eye reads the
 * gap between them as something forcing the stones apart.
 *
 * x runs tail to head, y across, and the ends are feathered so the crack
 * opens and closes rather than starting and stopping.
 */
const rimTex = () => tex('vs-rim', (g, W, H) => {
  const line = (y, width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(0, y); g.lineTo(W, y);
    g.stroke();
  };
  for (const y of [H * 0.11, H * 0.89]) {
    line(y, H * 0.26, 0.10, H * 0.10);
    line(y, H * 0.075, 0.34, H * 0.025);
    line(y, H * 0.022, 0.88, H * 0.006);
  }
  g.filter = 'none';
  const along = g.createLinearGradient(0, 0, W, 0);
  along.addColorStop(0.00, 'rgba(0,0,0,0)');
  along.addColorStop(0.42, 'rgba(0,0,0,0.20)');
  along.addColorStop(0.86, 'rgba(0,0,0,1)');
  along.addColorStop(1.00, 'rgba(0,0,0,0.7)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
}, 256, 64);

/**
 * The seam: the crack the shadow goes through, at the card's Void-side edge.
 *
 * A HARD STRAIGHT SLIT. Every other opening in this game is round — the Gloom
 * Bolt tears a circular hole, the grave opens as a round mouth, the Void
 * itself is a disc — and a short ruled line of light is the one opening shape
 * left. It is also the only hard-edged thing in the motif, which is what makes
 * it read as a cut rather than as more glow.
 */
const seamTex = () => tex('vs-seam', (g, W, H) => {
  const mid = H * 0.5;
  const pass = (width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(W * 0.04, mid);
    g.lineTo(W * 0.96, mid);
    g.stroke();
  };
  pass(H * 0.62, 0.10, H * 0.18);
  pass(H * 0.22, 0.34, H * 0.05);
  pass(H * 0.055, 1.0, H * 0.008);
  g.filter = 'none';
  // The ends die away over a third of the length: a blunt end reads as a bar
  // with a length, and this has to read as a crack with no particular end.
  const ends = g.createLinearGradient(0, 0, W, 0);
  ends.addColorStop(0.00, 'rgba(0,0,0,0)');
  ends.addColorStop(0.20, 'rgba(0,0,0,0.65)');
  ends.addColorStop(0.50, 'rgba(0,0,0,1)');
  ends.addColorStop(0.80, 'rgba(0,0,0,0.65)');
  ends.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = ends;
  g.fillRect(0, 0, W, H);
}, 256, 48);

/* ------------------------------------------------------------- the ribbon */

/**
 * A flat strip of quads whose spine is rewritten every frame, so the runner
 * can follow a curved path and taper along it. A single stretched quad was the
 * first cut and it could not bend: on any path that was not a straight line
 * the body cut the corner and the head arrived pointing the wrong way.
 */
function ribbon(segs) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));
  const uv = new Float32Array(segs * 2 * 2);
  for (let i = 0; i < segs; i++) {
    const k = i / (segs - 1);
    uv[i * 4 + 0] = k; uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = k; uv[i * 4 + 3] = 1;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < segs - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  return geo;
}

// A rounded nose and a long thin tail. The taper is in the geometry rather
// than in the map so it survives being stretched to any length.
const girth = (k) => Math.min(1, k * 2.6) ** 0.55
  * Math.sqrt(Math.max(0, 1 - (Math.max(0, k - 0.86) / 0.14) ** 2));

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. A named motif on four cards
// can afford a journey; the flourish next door (cast-auroxi) gets 1.1.
const SPAN = 1.55;
const OPEN = 0.13;     // the seam cracks at the card's edge
const OUT0 = 0.19;     // the shadow starts pouring through it
const OUT1 = 0.52;     // and reaches the Void
const BACK0 = 0.57;    // something comes back out
const BACK1 = 0.82;    // and surfaces under the card
const CLOSE = 0.80;    // the seam shuts, and the square comes back

const flat = (m) => { m.rotation.x = -Math.PI / 2; return m; };

/** A flat quad on the stones. Everything in this motif is one of these. */
function decal(map, w, h, extra = {}) {
  return flat(new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, ...extra,
    }),
  ));
}

/**
 * A decal rotated -90° about x maps its local +y to world -z, so a heading is
 * set with rotation.z — and the sign is not obvious. Getting it wrong pointed
 * every crest back the way it had come.
 */
const heading = (m, dx, dz) => { m.rotation.z = Math.atan2(-dx, -dz); };

export function voidstep(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const pit = kit.at(9) || new THREE.Vector3(-5.37, 0, 0);

  /* ---------------------------------------------------------- the passage */

  // From the card to the lip of the Void, bowed a little to one side. A ruled
  // line between the two read as a wire strung across the table; a shadow
  // moving under a floor slinks.
  const A = new THREE.Vector3(p.x, STONE, p.z);
  const B = new THREE.Vector3(pit.x, STONE, pit.z);
  // A fighter that is ALREADY standing in the Void has nowhere to travel, and
  // a zero-length path collapses every rib of the ribbon onto one point. It
  // goes under the board toward the middle of it instead — still a passage,
  // still away from where it was.
  if (B.distanceTo(A) < 1.6) B.set(0, STONE, 0);
  const run = B.clone().sub(A);
  const reach = Math.hypot(run.x, run.z) || 1;
  const dir = new THREE.Vector3(run.x / reach, 0, run.z / reach);
  // Bowed toward the near side of the table, so the curve is across the screen
  // rather than into it — a bow along the view direction is foreshortened to
  // nothing at this camera.
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  if (side.z < 0) side.negate();
  const C = A.clone().lerp(B, 0.5).addScaledVector(side, Math.min(0.85, reach * 0.13));

  const path = (u, out) => {
    const v = 1 - u;
    return out.set(
      v * v * A.x + 2 * v * u * C.x + u * u * B.x,
      STONE,
      v * v * A.z + 2 * v * u * C.z + u * u * B.z,
    );
  };

  // Where the passage leaves the card: walked along the PATH until it is clear
  // of the card's own footprint, rather than measured along the straight line
  // to the pit. The path is bowed, so the two disagree by enough that the seam
  // sat inside the card and was occluded by it for the whole motif.
  const probe = new THREE.Vector3();
  let uEdge = 0.02;
  while (uEdge < 0.5) {
    path(uEdge, probe);
    const dx = Math.abs(probe.x - A.x), dz = Math.abs(probe.z - A.z);
    if (dx > CARD_W * 0.5 + 0.12 || dz > CARD_H * 0.5 + 0.12) break;
    uEdge += 0.005;
  }
  path(uEdge, probe);
  const mouthAt = probe.clone();
  path(Math.max(0, uEdge - 0.02), probe);
  const mouthDir = new THREE.Vector3().copy(mouthAt).sub(probe).setY(0).normalize();

  const g = new THREE.Group();

  /* ------------------------------------------------------------- the pool */

  // The square's light is taken first. The shadow has to come from somewhere,
  // and a runner that simply appeared at the card's edge read as a thing
  // thrown across the board rather than as the fighter's own shadow leaving.
  //
  // At stone height, so the card itself stays lit — darkening the card is what
  // possess does, and this motif is the fighter going out from under its own
  // feet, not being smothered where it stands.
  const pool = decal(wellTex(), CARD_W * 1.75, CARD_W * 1.75);
  pool.position.set(p.x, STONE - 0.006, p.z);
  pool.renderOrder = 1;
  g.add(pool);

  /* ------------------------------------------------------------- the seam */

  const seam = decal(seamTex(), CARD_W * 1.02, 0.42,
    { blending: THREE.AdditiveBlending, color: COLD });
  seam.position.set(mouthAt.x, STONE + 0.006, mouthAt.z);
  heading(seam, mouthDir.x, mouthDir.z);
  seam.renderOrder = 6;
  g.add(seam);

  /* ----------------------------------------------------------- the runner */

  const SEGS = 34;
  const outGeo = ribbon(SEGS);
  const outBody = new THREE.Mesh(outGeo, new THREE.MeshBasicMaterial({
    map: bodyTex(), color: 0x04010c, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  outBody.frustumCulled = false;
  outBody.renderOrder = 2;

  // THE HAZE: a much wider, much softer band of dark running with the body.
  //
  // This is what carries the motif at the size a square really is. The body
  // itself spends most of the crossing correctly hidden under the cards it is
  // passing beneath, so all a player saw was a smudge flickering in the gaps
  // between them. The haze is four fifths of a tile wide, so a whole flagstone
  // goes dark as the thing passes under it and comes back up lit behind it —
  // three squares dimming in sequence reads from across the table, and it is
  // the same picture as the pool the shadow left, which is the point.
  const outGlowGeo = ribbon(SEGS);
  const outGlow = new THREE.Mesh(outGlowGeo, new THREE.MeshBasicMaterial({
    map: hazeTex(), color: 0x050211, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  outGlow.frustumCulled = false;
  outGlow.renderOrder = 1;

  const outRimGeo = ribbon(SEGS);
  const outRim = new THREE.Mesh(outRimGeo, new THREE.MeshBasicMaterial({
    map: rimTex(), color: COLD, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  outRim.frustumCulled = false;
  outRim.renderOrder = 5;

  const crest = decal(crestTex(), 2.45, 0.50,
    { blending: THREE.AdditiveBlending, color: COLD });
  crest.position.y = STONE + 0.008;
  crest.renderOrder = 7;

  /* ----------------------------------------------------------- the return */

  const backGeo = ribbon(SEGS);
  const backBody = new THREE.Mesh(backGeo, new THREE.MeshBasicMaterial({
    map: bodyTex(), color: 0x04010c, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  backBody.frustumCulled = false;
  backBody.renderOrder = 2;
  const backGlowGeo = ribbon(SEGS);
  const backGlow = new THREE.Mesh(backGlowGeo, new THREE.MeshBasicMaterial({
    map: hazeTex(), color: 0x050211, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  backGlow.frustumCulled = false;
  backGlow.renderOrder = 1;
  const backRimGeo = ribbon(SEGS);
  const backRim = new THREE.Mesh(backRimGeo, new THREE.MeshBasicMaterial({
    map: rimTex(), color: COLD, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  backRim.frustumCulled = false;
  backRim.renderOrder = 5;

  const backCrest = decal(crestTex(), 1.95, 0.42,
    { blending: THREE.AdditiveBlending, color: COLD });
  backCrest.position.y = STONE + 0.008;
  backCrest.renderOrder = 7;

  g.add(outBody, outGlow, outRim, backBody, backGlow, backRim, crest, backCrest);

  /* ------------------------------------------------------- the surfacing */

  // What is left at the card when the return arrives: darkness squeezed out
  // from under all four edges at once. It lives at stone height and the card
  // covers its middle, so what shows is a rim of black pushing out past the
  // card's outline — the picture of something coming up UNDERNEATH it, and
  // nothing else on this table makes that shape.
  const swell = decal(wellTex(), CARD_W * 1.95, CARD_W * 1.95);
  swell.position.set(p.x, STONE + 0.002, p.z);
  swell.renderOrder = 4;
  g.add(swell);

  // blobTexture is (INNER, OUTER). Written the other way round — which is how
  // this and the pit's flare below started life — the quad's corners fall
  // outside the gradient circle and take the last stop, so what appeared on
  // the table was a hard bright SQUARE two squares across.
  const lip = decal(blobTexture('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'),
    CARD_W * 1.9, CARD_W * 1.9, { blending: THREE.AdditiveBlending, color: VIOLET });
  lip.position.set(p.x, STONE + 0.004, p.z);
  lip.renderOrder = 5;
  g.add(lip);

  /* ------------------------------------------------------- the Void's end */

  // The pit answers: its own light swelling on the ground at the lip as the
  // shadow goes in, so the far end of the passage is visibly the thing already
  // turning out there rather than a place the shadow happens to stop.
  const gulp = decal(blobTexture('rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'),
    5.4, 5.4, { blending: THREE.AdditiveBlending, color: VIOLET });
  gulp.position.set(B.x, 0.052, B.z);
  gulp.renderOrder = 4;
  g.add(gulp);

  const head = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const next = new THREE.Vector3();

  /**
   * Lay one runner down the path between two parameters. `hw` is its half
   * width at the head; the girth curve does the rest.
   */
  const lay = (geo, u0, u1, hw) => {
    const pos = geo.attributes.position.array;
    for (let i = 0; i < SEGS; i++) {
      const k = i / (SEGS - 1);
      const u = u0 + (u1 - u0) * k;
      path(u, head);
      // the local heading, from the path either side of this rib
      path(Math.max(0, u - 0.01), prev);
      path(Math.min(1, u + 0.01), next);
      next.sub(prev);
      const len = Math.hypot(next.x, next.z) || 1;
      const sx = -next.z / len, sz = next.x / len;
      // The width and the line of the spine wander, and they wander by PATH
      // parameter rather than by rib index — so the bumps stand still in the
      // world and the shadow slides past them, the way a thing moving under a
      // floor is shaped by the floor. Keyed to the rib instead, the whole body
      // shimmered as it stretched, which reads as a bad shader.
      const w = hw * girth(k)
        * (0.86 + 0.09 * Math.sin(u * 13) + 0.05 * Math.sin(u * 27 + 1.7));
      const off = 0.10 * Math.sin(u * 9 + 0.6);
      const cx = head.x + sx * off, cz = head.z + sz * off;
      pos[i * 6 + 0] = cx - sx * w; pos[i * 6 + 1] = STONE; pos[i * 6 + 2] = cz - sz * w;
      pos[i * 6 + 3] = cx + sx * w; pos[i * 6 + 4] = STONE; pos[i * 6 + 5] = cz + sz * w;
    }
    geo.attributes.position.needsUpdate = true;
  };

  /** Put a crest on the head of a runner, pointing the way it is going. */
  const ride = (m, u) => {
    path(u, head);
    path(Math.max(0, u - 0.01), prev);
    path(Math.min(1, u + 0.01), next);
    m.position.set(head.x, STONE + 0.008, head.z);
    heading(m, next.x - prev.x, next.z - prev.z);
  };

  kit.hold(g, SPAN, (t) => {
    /* --- the pool. Deep under the fighter for the whole passage, because the
       fighter is AWAY: a square that lit back up the moment the runner left
       read as the shadow going off on an errand of its own. */
    const dug = easeOut(Math.min(1, t / 0.14));
    const filled = 1 - easeIn(Math.min(1, Math.max(0, (t - CLOSE) / (1 - CLOSE))));
    pool.material.opacity = 0.88 * dug * filled;
    pool.scale.setScalar(0.55 + 0.45 * dug);

    /* --- the seam. It cracks, holds while the shadow pours through, dims to
       a thread for the journey, and flares once more as the return comes up.
       Shut in between, the arrival had to open a second crack out of nowhere
       and the two ends of the trip looked like two different effects. */
    const cut = Math.min(1, Math.max(0, (t - OPEN) / 0.07));
    const shut = 1 - easeIn(Math.min(1, Math.max(0, (t - CLOSE) / (1 - CLOSE))));
    const pour = Math.max(0, 1 - Math.abs(t - OUT0 - 0.03) / 0.12) ** 1.4;
    const rise = Math.max(0, 1 - Math.abs(t - BACK1) / 0.10) ** 1.4;
    seam.material.opacity = (0.16 + 0.84 * Math.max(pour, rise)) * cut * shut;
    seam.scale.set(0.70 + 0.34 * Math.max(pour, rise), 0.55 + 1.5 * Math.max(pour, rise), 1);

    /* --- the runner out. Its TAIL stays pinned at the card until the head is
       most of the way there, so for the middle of the motif there is one long
       thing reaching from under the fighter to wherever the head has got to.
       Released together, the two ends travelled as a short dash and the
       passage had no length in it — it read as a pellet, not a tunnel. */
    const uo = Math.min(1, Math.max(0, (t - OUT0) / (OUT1 - OUT0)));
    if (uo > 0 && t < BACK0 + 0.10) {
      // It is squeezed out of the seam and then drawn in: nearly linear with
      // a little acceleration. The first cut eased OUT of the card, which put
      // the head halfway to the pit in the first sixth of the journey — the
      // shadow appeared to be fired from the square rather than to crawl.
      const h = uEdge + (1 - uEdge) * (uo * 0.62 + easeIn(uo) * 0.38);
      // THE TAIL STAYS AT THE SEAM. The shadow is being poured out of the
      // card, not thrown from it, so for most of the journey there is one
      // unbroken thing reaching from under the fighter to wherever the head
      // has got to — and that length is the only part of this the eye can
      // follow while the head is passing under somebody else's card.
      //
      // Two earlier versions ran the tail on the same curve a beat behind the
      // head. Both gave a body about two units long on an eight-unit passage:
      // a lozenge skating across the board, which is a projectile, and a
      // projectile is what every bolt in this game already is.
      const lag = Math.max(0, (uo - 0.70) / 0.30);
      const u0 = uEdge + (h - uEdge) * 0.78 * easeIn(Math.min(1, lag));
      // WIDER THAN A CARD, on purpose. A card is 1.76 deep and the passage
      // runs along a row, so a narrower runner spent the whole crossing
      // hidden under the fighters it was passing beneath and only flickered in
      // the gaps between them. At 2.1 across, a hand's breadth of it shows
      // down both sides of every card it goes under — which is the one frame
      // that says UNDERNEATH rather than merely NEAR.
      lay(outGeo, u0, h, 1.05);
      lay(outGlowGeo, u0, h, 2.35);
      lay(outRimGeo, u0, h, 1.05);
      const gone = easeIn(Math.min(1, Math.max(0, (t - OUT1) / 0.10)));
      outBody.material.opacity = 0.96 * Math.min(1, uo * 8) * (1 - gone);
      outGlow.material.opacity = 0.88 * Math.min(1, uo * 8) * (1 - gone);
      outRim.material.opacity = 0.58 * Math.min(1, uo * 8) * (1 - gone);
      crest.material.opacity = Math.min(1, uo * 10) * (1 - gone) * (0.55 + 0.45 * (1 - uo));
      crest.scale.set(0.8 + 0.4 * (1 - uo), 1, 1);
      ride(crest, h);
    } else {
      outBody.material.opacity = 0;
      outGlow.material.opacity = 0;
      outRim.material.opacity = 0;
      crest.material.opacity = 0;
    }

    /* --- the Void takes it. */
    const eat = Math.min(1, Math.max(0, (t - OUT1 + 0.04) / 0.16));
    gulp.material.opacity = 0.42 * Math.sin(Math.PI * eat) ** 0.8;
    gulp.scale.setScalar(0.42 + 0.5 * easeOut(eat));

    /* --- and gives something back. Faster than it went: the departure is a
       slink and the return is a snap, which is the only thing keeping an
       out-and-back from reading as nothing having happened. */
    const ub = Math.min(1, Math.max(0, (t - BACK0) / (BACK1 - BACK0)));
    if (ub > 0) {
      // Off the mark fast and slowing into the card. At `1 - easeIn(ub)` — the
      // obvious way to run a parameter backwards — the return was still only a
      // sixth of the way home when it was more than half over, so the whole
      // leg happened in the last few frames and never appeared in a shot.
      const hb = 1 - (ub * 0.55 + easeOut(ub) * 0.45);
      // and the tail hangs back at the pit, exactly as the out-leg's hung back
      // at the card, so both halves of the trip are one long thing and not two
      // short ones
      const lagb = Math.max(0, (ub - 0.50) / 0.50);
      const ut = 1 - (1 - hb) * 0.80 * easeIn(Math.min(1, lagb));
      // lay() runs its first argument to its second as TAIL to HEAD: passed
      // the other way round the return's bright nose pointed back at the pit
      // it had just come out of.
      lay(backGeo, ut, hb, 0.80);
      lay(backGlowGeo, ut, hb, 2.00);
      lay(backRimGeo, ut, hb, 0.80);
      const done = easeIn(Math.min(1, Math.max(0, (t - BACK1) / 0.08)));
      backBody.material.opacity = 0.9 * Math.min(1, ub * 10) * (1 - done);
      backGlow.material.opacity = 0.84 * Math.min(1, ub * 10) * (1 - done);
      backRim.material.opacity = 0.52 * Math.min(1, ub * 10) * (1 - done);
      backCrest.material.opacity = Math.min(1, ub * 10) * (1 - done);
      ride(backCrest, hb);
      // the crest points the way it is TRAVELLING, and this one is going the
      // other way down the same path
      backCrest.rotation.z += Math.PI;
    } else {
      backBody.material.opacity = 0;
      backGlow.material.opacity = 0;
      backRim.material.opacity = 0;
      backCrest.material.opacity = 0;
    }

    /* --- the surfacing. */
    const up = Math.min(1, Math.max(0, (t - BACK1 + 0.06) / 0.14));
    const fall = 1 - easeIn(Math.min(1, Math.max(0, (t - BACK1 - 0.02) / 0.15)));
    swell.material.opacity = 0.85 * easeOut(up) * fall;
    swell.scale.setScalar(0.62 + 0.55 * easeOut(up));
    lip.material.opacity = 0.34 * easeOut(up) * fall;
    lip.scale.setScalar(0.66 + 0.62 * easeOut(up));
  });

  /* ----------------------------------------------------------- the lights */

  // Two breaths, one at each end of the passage, both LOW and both short. Hung
  // high they lit the card faces and undid the darkening the whole motif is
  // built on.
  kit.after(OPEN * SPAN, () => {
    kit.light(new THREE.Vector3(mouthAt.x, STONE + 0.03, mouthAt.z),
      VIOLET, { power: 5.0, seconds: 0.30, reach: 2.4 });
  });
  kit.after(OUT1 * SPAN, () => {
    kit.light(new THREE.Vector3(B.x, 0.40, B.z), VIOLET,
      { power: 16, seconds: 0.42, reach: 6 });
  });
  kit.after(BACK1 * SPAN, () => {
    kit.light(new THREE.Vector3(p.x, STONE + 0.02, p.z), VIOLET,
      { power: 8, seconds: 0.34, reach: 3.0 });
  });
}

/* ------------------------------------------------- what becomes of the card */

/**
 * How long a card this motif touched must stay on the table. The seam cracks
 * at 0.20s and the shadow is pouring through it by 0.29s, so 0.43 puts the
 * card's leaving — and the move Null Gate makes, which this number also gates
 * — just after the way out exists and well before the pit answers.
 */
export const timing = { kill: 0.43 };

/**
 * DROP SHADOW puts a fighter into its owner's hand, and the generic return —
 * lifted off the board and flown over it to the player's seat — is the one
 * path this motif forbids. The whole card says the fighter goes UNDERNEATH.
 *
 * So it sinks, straight down through its own shadow. The arena's ground is an
 * opaque unbroken plane and everything below y=0 is behind it, which is a
 * problem for every other effect here and a gift to this one: the card is
 * really swallowed, not faded out. Then, where the hand is, it comes back up
 * out of the ground and is taken.
 */
export const exit = {
  hand(kit, piece, square, ev, done) {
    const at = piece.group.position.clone();
    const to = kit.hand(piece.owner);
    piece.animating = true;

    const mats = [piece.frontMat, piece.backMat, piece.card3d.material[0]];
    const was = mats.map((m) => ({ col: m.color.clone(), tr: m.transparent, op: m.opacity }));
    for (const m of mats) m.transparent = true;
    // The contact shadow is parented to the card but pinned to the ground each
    // frame, so a sinking card left its own shadow lying on the flagstone for
    // the rest of the effect. The motif paints its own dark there anyway.
    const hadContact = piece.contact.visible;
    piece.contact.visible = false;

    // The mouth it goes through: dark at stone height, so the flagstone under
    // the card is already black by the time the card reaches it.
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 2.0, CARD_W * 2.0),
      new THREE.MeshBasicMaterial({
        map: blobTexture('rgba(2,0,8,0.96)', 'rgba(2,0,8,0)'),
        transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    flat(mouth);
    mouth.position.set(at.x, STONE - 0.002, at.z);

    // And the one where it comes up. Cold rather than black: the far end of
    // the passage is a thing opening, not a thing closing.
    const out = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 2.2, CARD_W * 2.2),
      new THREE.MeshBasicMaterial({
        map: blobTexture('rgba(255,255,255,0.6)', 'rgba(255,255,255,0)'),
        color: VIOLET, transparent: true, opacity: 0, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    flat(out);
    out.position.set(to.x, 0.05, to.z);

    const SPAN2 = 1.15;
    const DOWN = 0.34;     // under the ground by here
    const UP = 0.60;       // and back out of it here
    kit.hold(mouth, SPAN2, (t) => {
      mouth.material.opacity = 0.9 * Math.min(1, t / 0.10)
        * (1 - easeIn(Math.min(1, Math.max(0, (t - 0.40) / 0.45))));
      mouth.scale.setScalar(0.5 + 0.6 * easeOut(Math.min(1, t / 0.22)));
    });
    kit.hold(out, SPAN2, (t) => {
      const k = Math.min(1, Math.max(0, (t - UP + 0.10) / 0.16));
      out.material.opacity = 0.5 * easeOut(k) * (1 - easeIn(Math.min(1, Math.max(0, (t - UP - 0.08) / 0.30))));
      out.scale.setScalar(0.45 + 0.7 * easeOut(k));
    });

    kit.anim.add(SPAN2, (t) => {
      if (t < DOWN) {
        // Down. It dips a hair first — nothing heavy drops without settling —
        // then goes, accelerating, and darkens as it passes the stone.
        const k = t / DOWN;
        const e = easeIn(Math.min(1, k * 1.08));
        piece.group.position.set(at.x, at.y + 0.06 * Math.sin(Math.PI * Math.min(1, k * 2.2))
          - e * 2.1, at.z);
        // a slight roll, so it goes edge-first into the dark rather than
        // riding down like a lift
        piece.tilt.rotation.x = -0.26 * e;
        piece.group.scale.setScalar(1 - 0.10 * e);
        for (let i = 0; i < mats.length; i++) {
          mats[i].color.copy(was[i].col).multiplyScalar(1 - 0.80 * easeOut(k));
        }
        return;
      }
      if (t < UP) {
        // Under. There is genuinely nothing to draw — the ground is opaque —
        // and that silence between the two ends is what sells the distance.
        piece.group.position.set(to.x, -2.5, to.z);
        return;
      }
      const k = Math.min(1, (t - UP) / (1 - UP));
      const e = easeOut(k);
      // Higher than the board, on purpose. The hand is off the near edge of
      // the table among grass and ruins, and a card that surfaced at ankle
      // height there was behind a tree for the whole rise — it has to clear
      // the scenery before it is taken.
      piece.group.position.set(to.x, -1.1 + e * 2.35, to.z);
      piece.tilt.rotation.x = -0.26 * (1 - e);
      // taken into the hand: the same shrink-and-fade every returning card
      // ends on, so this lands where the rest of the game's cards land
      piece.group.scale.setScalar(1.0 - 0.6 * easeIn(Math.max(0, (k - 0.25) / 0.75)));
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(was[i].col).multiplyScalar(0.20 + 0.80 * e);
        mats[i].opacity = was[i].op * (1 - easeIn(Math.min(1, Math.max(0, (k - 0.45) / 0.55))));
      }
    }, () => {
      // Pieces are pooled: a card that came back from the pool still dark,
      // half transparent and tipped on its edge is a ghost.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(was[i].col);
        mats[i].opacity = was[i].op;
        mats[i].transparent = was[i].tr;
      }
      piece.tilt.rotation.set(0, 0, 0);
      piece.group.scale.setScalar(1);
      piece.contact.visible = hadContact;
      piece.animating = false;
      done?.();
    });
  },
};
