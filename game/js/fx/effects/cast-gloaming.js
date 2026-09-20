// THE GLOAMING FLOURISH — the undead — grave-dust falling into a card the
// light has gone out of.
//
// What a Gloaming card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// The shape has to SINK. Refractory comes down as a shaft, Shardsworn breaks
// apart, Marvorren ripples outward, Auroxi weaves — every one of them either
// expands or rises. So this is the only downward drift on the table: motes fall
// down the picture, drawing in as they go, and are snuffed out where they meet
// the card. Nothing here rises, nothing expands outward, and nothing
// spirals — the winding drain belongs to the Shadow bolt (shadow.js), and a
// flourish seen forty times a game must not read as a small copy of a tactic.
//
// The other problem is that a dark effect on a dark board is invisible. The
// answer is not brighter purple — it is to bring the DARK yourself: a pool of
// it opens on the card, and the motes are then cold specks against black
// instead of cold specks against lit card art. The contrast is made locally,
// inside the card's own outline, so the table as a whole barely changes.
//
// One effect, one file.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/cast-gloaming.js --out /tmp/cg.png --settle 500
// which puts six ages of the motif on the board at once. The harness explains
// why wall-clock --settle cannot be trusted here.

import { THREE, CARD_W, easeOut, easeIn } from '../kit.js';

/**
 * The pool: near-black with a violet skirt, as one profiled texture.
 *
 * The falloff is the whole picture, so it is drawn by hand rather than taken
 * from the kit's blob. A blob's alpha is a straight line from the middle to
 * the rim, which on a card is a SMUDGE — no centre, no edge, nothing to look
 * at. This holds a dark plateau across the middle and then falls away over the
 * outer third, so it reads as a pool with a floor and an edge of its own.
 *
 * It is also violet where it is thin and near-black where it is deep, which is
 * how the motif gets its colour without a single bright pixel: normal-blended
 * violet at low alpha TINTS the card, where additive violet would have lit it.
 *
 * Kept for the life of the page — this fires on nearly every Gloaming card,
 * and kit.hold disposes materials but never their maps.
 */
let POOL = null;
function poolTexture() {
  if (POOL) return POOL;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0.00, 'rgba(4,1,10,0.97)');
  grd.addColorStop(0.36, 'rgba(6,2,14,0.92)');
  grd.addColorStop(0.54, 'rgba(16,6,34,0.72)');
  grd.addColorStop(0.68, 'rgba(52,20,108,0.42)');
  grd.addColorStop(0.84, 'rgba(40,15,88,0.16)');
  grd.addColorStop(1.00, 'rgba(40,16,90,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  POOL = t;
  return t;
}

/**
 * One mote of grave-dust, drawn as a COMET: a pale head low in the frame and a
 * violet tail running up out of it.
 *
 * Sprites cannot be rotated to face the way they are going — they are always
 * square to the camera — so a round blob stretched tall is a capsule, bright
 * all the way along, and reads as a glowing bar. Which end is which then
 * depends entirely on seeing it move, and a player catching the table out of
 * the corner of an eye never does. Baking the fall into the picture means a
 * single frozen frame already says DOWNWARD, which is the whole motif.
 *
 * Kept for the life of the page — this fires on nearly every Gloaming card,
 * and kit.hold disposes materials but never their maps.
 */
let DUST = null;
function dustTexture() {
  if (DUST) return DUST;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  // FACTION.Gloaming's lilac, pushed either side of itself: a blue-leaning
  // violet down the tail and a lighter one at the head. The faction entry is
  // not used directly because it is a PALE lilac, and additive blending plus
  // the arena's filmic tone mapping drive any pale colour to white — two
  // passes of this came out as pink-white scratches with no faction in them at
  // all. Holding the red down while the blue stays up is what reads as COLD.
  const down = g.createLinearGradient(0, 0, 0, 128);
  down.addColorStop(0.00, 'rgba(70,30,170,0)');
  down.addColorStop(0.40, 'rgba(108,62,224,0.34)');
  down.addColorStop(0.72, 'rgba(140,92,246,0.72)');
  down.addColorStop(0.90, 'rgba(174,128,255,0.96)');
  down.addColorStop(1.00, 'rgba(174,128,255,0)');
  g.fillStyle = down;
  g.fillRect(0, 0, 64, 128);
  // and feathered off at the sides, so it has no edges of its own
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.22, 'rgba(0,0,0,0.42)');
  across.addColorStop(0.50, 'rgba(0,0,0,1)');
  across.addColorStop(0.78, 'rgba(0,0,0,0.42)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  DUST = t;
  return t;
}

/**
 * Where the flat parts lie. `kit.at` answers 0.4 for a bare square but about
 * 0.2 for a card, whose face is at ~0.22 — so anything drawn at the raw height
 * either floats above an empty square or sinks into an occupied one.
 *
 * The clearance is 0.055 and not the 0.03 this started with, which cost an
 * hour: at 0.03 the pool lands ON the card face to within a rounding error,
 * loses the depth test (gl.LESS fails on equal) and is drawn over the stone
 * around the card but NOT over the card itself — so the one place the motif
 * has to be dark was the one place nothing appeared, and the screenshots
 * looked as though the effect had never fired.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

// kit.hold hands the tick a FRACTION of the span, not seconds, so every moment
// below is a fraction and SPAN is the only number in time. The animator holds
// the UI while this runs and it runs on nearly every card, so three quarters
// of a second is a budget, not a target.
const SPAN = 0.75;
const OPEN = 0.24;        // the light draining out of the card
const SHUT = 0.62;        // the pool drawing back in

// The pool is exactly as wide as the card, so its skirt runs out at the card's
// own edge and no dark ever lands on the stone between squares. At 0.62 of the
// card it reached past the corners and the card simply switched off, which is
// not a pool at all: it buries the art the motif is supposed to be marking and
// leaves no shape to read.
const R = CARD_W * 0.5;

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const g = new THREE.Group();
  g.position.copy(p).setY(flatY(p));

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(R, 40),
    new THREE.MeshBasicMaterial({
      map: poolTexture(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  g.add(pool);

  // The dust. Sprites scaled thin and tall are streaks in SCREEN space however
  // the camera is turned, so the downward read survives the table's slow orbit
  // — a round mote of the same size is a speck with no direction in it at all.
  //
  // Each also draws IN as it comes down, from the width of the card art to
  // well inside the pool. Parallel fall was rain on a card; the taper is what
  // makes it one thing being drawn into one place, and it manages that without
  // a spiral.
  //
  // Fifteen chunky ones rather than two dozen fine ones. In play a card is only
  // about a hundred pixels across, and fine specks at that size are noise: half
  // of them land on the same pixel as a piece of card art and are simply gone.
  // Chunkier survives the real size, which is the only size that counts.
  const motes = [];
  const N = 15;
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dustTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // Placed on a golden-angle spiral, and SEEDED on a stride through the
    // same count, rather than both being drawn at random. Random gave a good
    // motif on average and a bad one often: a cast where four motes happened
    // to land in the same corner, or where the middle of the span happened to
    // be empty, and a flourish this frequent cannot have bad days. The stride
    // is coprime with the count so WHEN a mote falls stays uncorrelated with
    // WHERE — without it the outer ring was always the late one and the fall
    // visibly unwound from the middle outward.
    const a = i * 2.39996 + Math.random() * 0.45;
    const r = Math.sqrt((i + 0.55) / N) * 0.62;
    const slot = (i * 7) % N;
    s.userData = {
      x: Math.cos(a) * r, z: Math.sin(a) * r,
      top: 0.5 + Math.random() * 0.52,
      // A DRIZZLE, not a burst: seeding runs across three quarters of the
      // motif, so there is always something on its way down and the last few
      // are still falling as the pool closes over them. One wave left the back
      // half of the span empty and the whole thing read as a sparkle that had
      // already happened rather than a fall in progress. The power curve
      // bunches the seeding toward the front, because spread evenly the first
      // eighth of a second — which is most of what a player actually looks at
      // — held one mote and nothing else.
      off: ((slot + Math.random() * 0.9) / N) ** 1.4 * 0.55,
      dur: 0.24 + Math.random() * 0.1,
      w: 0.105 + Math.random() * 0.05,
      len: 0.26 + Math.random() * 0.16,
      // not all of it catches the light: identical motes fell as a machine,
      // and dust is the one thing that should not look manufactured
      lit: 0.55 + Math.random() * 0.45,
    };
    motes.push(s);
    g.add(s);
  }

  kit.hold(g, SPAN, (t) => {
    // The dark arrives WITH the first of the dust rather than ahead of it. Sped
    // up to a tenth of a second the card went black before anything had fallen
    // into it and the motif read as a flashbulb in reverse; brought in at the
    // speed of the fall, the dust looks like the cause of it.
    const open = easeOut(Math.min(1, t / OPEN));
    // and it draws BACK IN rather than fading, because a pool that only
    // dissolves reads as a cloud clearing, and this is something taken away
    const pull = easeIn(Math.max(0, (t - SHUT) / (1 - SHUT)));
    // It CLOSES ON the card: wide and faint, then tight and deep. An opening
    // pool is what every other motif on this table does with its rings, and a
    // pool that merely faded up had no gesture in it at all.
    pool.scale.setScalar(1.75 - open * 0.75 - pull * 0.72);
    pool.material.opacity = 0.95 * open * (1 - pull);

    for (const m of motes) {
      const u = m.userData;
      const k = (t - u.off) / u.dur;
      if (k <= 0 || k >= 1) { m.material.opacity = 0; continue; }
      // gathers speed on the way down — but k**3 dropped them almost from
      // rest and then flicked them through the last third too fast to see
      const fall = k * k * 0.8 + k * 0.2;
      const draw = 1 - fall * 0.55;
      m.position.set(u.x * draw, u.top * (1 - fall) + 0.015, u.z * draw);
      // The streak lengthens with the speed, so the fall has weight in it — off
      // a floor, because a mote that starts as a dot spends its first fifty
      // milliseconds invisible, and the first fifty milliseconds are most of
      // what a player actually sees of this.
      m.scale.set(u.w, 0.17 + fall * u.len, 1);
      // Snuffed AT the card, not faded out above it: the end of the fall is the
      // whole point, and motes that thinned away in mid-air looked like smoke
      // coming up off the card instead of dust going down into it. The ceiling
      // is just off full because at full strength the additive heads clipped
      // and the dust stopped being violet — but pulling the ALPHA down to fix
      // that made it vanish on a dark card, so colour was what had to give.
      m.material.opacity = 0.95 * u.lit * Math.min(1, k * 9) * Math.min(1, (1 - k) * 5);
    }
  });
}
