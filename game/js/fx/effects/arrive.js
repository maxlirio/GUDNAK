// THE ARRIVAL — something lands on a square it has no business being on.
//
// Shared by 1 card: C048 Reckless Chimera. "Deploy this fighter to an
// unoccupied square that is not an opponent's Gates" — so unlike every other
// fighter in the game it does not come in at the back and walk; it turns up
// anywhere on the field, including in the middle of your line. Its deploy also
// kills every power-I fighter beside it, which settles the tone: this is not
// an entrance, it is an impact.
//
// THE FLAGSTONE GOES FIRST. The whole motif is built round one beat that
// nothing else on this table has: the stone cracks BEFORE anything is there.
// Nine fractures run out from the empty square while the card is still in the
// air — dark splits with barely an ember in them — and then the thing lands in
// the middle of them, lights every one of them up at once, and throws the
// crystal out of its own cracks. An arrival that only starts
// when the card lands is a landing; an arrival the board saw coming is a
// fighter that had no business being there.
//
// It is timed off ../../anim.js: a deployed card is dealt in over 0.46s and
// lands with a thump, so the impact beat here is at 0.46s exactly and the
// fractures have the whole flight to run.
//
// WHAT IT IS NOT: ./wander.js, the other "somebody is suddenly there" motif.
// That one is quiet and uncanny — a long human shadow with no figure over it,
// standing still, never seen crossing between places. A Reckless Chimera is
// neither quiet nor uncanny, and there is nothing in this file that stands
// still or that you have to look at twice.
//
// Nor is it ./shardfire.js, whose palette it shares on purpose — the faction's
// red-pink crystal is its signature and a Shardsworn arrival in any other
// colour would belong to somebody else. But that motif is FIRE: tongues, a
// puff, embers rising, a card burning where it stands. There is no flame here
// at all, nothing rises, and every single thing this throws is lying flat on
// the flagstone within a second. Same palette, opposite shape.
//
// EVERYTHING STAYS ON ITS OWN SQUARE, which is the expensive lesson that file
// records: an earlier version of it threw splinters at 4-7 units a second
// across a 2.5-unit tile, and half a second after every death there were flat
// pink diamonds lying two squares away.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=520" \
//             --eval tools/fxdemo/arrive.js --out /tmp/arrive-520.png \
//             --wait 8000 --settle 500
// ?t is milliseconds INTO the motif, ?me is the square, ?zoom drops the camera
// in and ?deploy=0 skips the card's own flight so the ground can be judged on
// its own.

import { THREE } from '../kit.js';
import { squareToWorld } from '../../board.js';
import { TILE } from '../../arena.js';

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rnd = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
const SPAN = 1.3;
// 0.46s, which is exactly how long ../../anim.js takes to deal a card in. The
// fractures run for the whole of the flight and the impact lands on the frame
// the card does — a beat either side of that and the motif reads as two
// unrelated things happening near each other.
const HIT = 0.46 / SPAN;

/* ---------------------------------------------------------------- colour */

// ./shardfire.js's own palette, deliberately: the red-pink crystal is what
// Shardsworn LOOKS like and an arrival in any other colour belongs to another
// faction. Nothing here is additive — under ACES overlapping additive halos
// sum past 1.0 and go white, and a white slab on the square the card is
// landing on would hide the card.
const HOT = new THREE.Color(0xff2f68);
const DEEP = new THREE.Color(0x8d1740);
const CHAR = new THREE.Color(0x1a0c0e);
// What the fractures are WHILE THE THING IS STILL IN THE AIR. The first pass
// ran them at a quarter of the way to HOT for the whole flight and they came
// out as red veins crawling over the flagstone — a spell being cast on the
// square, not stone giving way. Nearly black, with barely an ember in the
// hairline, is what a split in a lit flagstone looks like; the colour is spent
// all at once on the landing instead.
const COLD = new THREE.Color(0x3c1018);

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
 * One fracture, running left to right, tapering to nothing at the far end.
 *
 * THREE of them and not one: nine identical spokes round a point is a
 * compass rose, which is a diagram. Each is a dark split with a lit hairline
 * down the middle of it — the dark is what reads on lit flagstone and the
 * hairline is the only part that ever carries the faction's colour.
 *
 * Painted with the split DARK and the line WHITE in the same canvas, because
 * the whole shape is the contrast between the two and a material tint can only
 * give one value.
 */
const crackTex = (n) => tex(`crack${n}`, (g, W, H) => {
  g.clearRect(0, 0, W, H);
  let s = 90210 + n * 7717;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const cy = H / 2;
  // The path of the split: a run of short straight legs, because a fracture in
  // stone is not a curve. Kept inside a narrowing envelope so it tapers.
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    pts.push([u * W, cy + (rand() - 0.5) * H * 0.62 * (1 - u) ** 0.6]);
  }
  const walk = (lw, style, jitter) => {
    g.lineJoin = 'miter';
    g.lineCap = 'butt';
    for (let i = 0; i < N; i++) {
      g.strokeStyle = style;
      g.lineWidth = Math.max(0.6, lw * (1 - i / N) ** 1.3);
      g.beginPath();
      g.moveTo(pts[i][0], pts[i][1] + jitter);
      g.lineTo(pts[i + 1][0], pts[i + 1][1] + jitter);
      g.stroke();
    }
  };
  // A wide soft shadow either side, then the split, then the hairline.
  g.filter = `blur(${H * 0.09}px)`;
  walk(H * 0.5, 'rgba(24,24,24,0.55)', 0);
  g.filter = 'none';
  walk(H * 0.34, 'rgba(10,10,10,0.97)', 0);
  walk(H * 0.05, 'rgba(255,255,255,1)', 0);
  // A couple of splits off the main one. A single unbranched line is a
  // scratch; stone splits into more stone.
  for (let b = 0; b < 2; b++) {
    const i = 3 + Math.floor(rand() * 7);
    const dy = (b ? 1 : -1) * H * 0.3;
    g.lineWidth = H * 0.1;
    g.strokeStyle = 'rgba(12,12,12,0.9)';
    g.beginPath();
    g.moveTo(pts[i][0], pts[i][1]);
    g.lineTo(pts[i][0] + W * 0.14, pts[i][1] + dy);
    g.stroke();
    g.lineWidth = H * 0.03;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.stroke();
  }
}, 256, 64);

/** A splinter of crystal: an angular sliver with one lit facet. */
const shardTex = (n) => tex(`shard${n}`, (g, W, H) => {
  const p = n ? [[0.02, 0.5], [0.55, 0.16], [0.98, 0.42], [0.62, 0.86]]
    : [[0.03, 0.44], [0.48, 0.06], [0.97, 0.56], [0.40, 0.94]];
  g.beginPath();
  g.moveTo(p[0][0] * W, p[0][1] * H);
  for (let i = 1; i < p.length; i++) g.lineTo(p[i][0] * W, p[i][1] * H);
  g.closePath();
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(120,120,120,1)');
  grd.addColorStop(1, 'rgba(38,38,38,1)');
  g.fillStyle = grd;
  g.fill();
}, 64, 64);

/** The grit the impact blows outward: a torn ring, not a clean one. */
const ringTex = () => tex('ring', (g, W) => {
  const c = W / 2;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = W * (0.34 + 0.07 * Math.sin(i * 2.3) + 0.04 * Math.sin(i * 5.1));
    const grd = g.createRadialGradient(c + Math.cos(a) * r, c + Math.sin(a) * r, 0,
      c + Math.cos(a) * r, c + Math.sin(a) * r, W * 0.11);
    grd.addColorStop(0, `rgba(255,255,255,${0.3 + 0.3 * Math.sin(i * 1.7)})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, W);
  }
}, 128, 128);

/** A soft blot, for the bruise the landing leaves in the stone. */
const blotTex = () => tex('blot', (g, W) => {
  const grd = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.44, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
}, 96, 96);

/* ------------------------------------------------------------------ main */

/** A flat decal lying on the stone. */
function plate(map, w, h, order) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, opacity: 0,
  }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = order;
  return m;
}

export function arrive(kit, at) {
  // ASK THE PIECE FIRST. A card uid and a square index are both numbers and
  // uids start at 1, so uids 1-8 collide with squares 0-8 — a motif that wrote
  // `typeof at === 'number' ? at : 4` read uid 44 as square 44 and painted
  // itself thirty-four units off the back of the board, silently.
  const piece = kit.piece(at);
  let sq = piece?.square;
  if (sq == null && typeof at === 'number' && at >= 0 && at < 9) sq = at;
  // The SQUARE and not the card's position: for the whole first half of this
  // the card is still in the air on its way in from the hand, and a motif
  // anchored to it would crack the stone somewhere over the player's lap.
  const p = (sq >= 0 && sq < 9) ? squareToWorld(sq) : kit.at(at);
  if (!p) return;

  const g = new THREE.Group();
  // Flat work sits 0.055 clear of whatever it lies on, and everything in this
  // motif lies on the FLAGSTONE at 0.080 rather than on a card: the square is
  // empty until the last third and the fractures have to be seen running out
  // from under the card once it lands. At less clearance the depth test
  // (gl.LESS fails on equal) drops a decal on the stone around the card and
  // not on the card itself.
  const GROUND = 0.08 + 0.055;
  g.position.set(p.x, GROUND, p.z);

  /* --------------------------------------------------------- the bruise */

  // What the stone looks like afterwards, and the only thing that outlives the
  // rest. Dark, because contrast on lit flagstone is bought with shadow — and
  // because a pale stain under a card is a spotlight.
  const bruise = plate(blotTex(), TILE * 0.82, TILE * 0.82, 1);
  bruise.material.color.copy(CHAR);
  g.add(bruise);

  /* ------------------------------------------------------- the fractures */

  // Nine, at uneven angles, of three different lengths and three different
  // drawings. Evenly spaced identical spokes are a compass rose.
  //
  // Length is set by the CARD, not by the stone. At 0.6-1.05 units they were
  // beautiful for the half second the square was empty and then the card
  // landed on top of every one of them — a fighter is 1.74 across, so a crack
  // shorter than 0.87 from the middle is a crack nobody ever sees. These run
  // to 1.45, which puts a third of each one out on bare flagstone beyond the
  // card's edge and stops them short of the joint (a tile is 2.5 across).
  const cracks = [];
  for (let i = 0; i < 9; i++) {
    const len = rnd(1.02, 1.45);
    const m = plate(crackTex(i % 3), len, rnd(0.2, 0.34), 3);
    m.geometry.translate(len / 2, 0, 0);
    m.rotation.z = -((i / 9) * Math.PI * 2 + rnd(-0.28, 0.28));
    m.position.y = 0.002;
    g.add(m);
    cracks.push({ mesh: m, wake: rnd(0, 0.42), rate: rnd(0.8, 1.25) });
  }

  /* ---------------------------------------------------------- the impact */

  // The ring of grit the landing blows out. Its size is set by the CARD, not
  // by the tile: the torn ring in the map sits at 0.34 of the plate, so at
  // TILE*0.9 and a scale of 1.2 it peaked at a radius of 0.76 — under the
  // fighter that had just landed on it, at 0.84 opacity, and invisible in
  // every frame. At TILE it clears the card's 0.87 half-width on its way out
  // and still dies inside its own flagstone.
  const ring = plate(ringTex(), TILE, TILE, 4);
  ring.material.color.copy(new THREE.Color(0xc8a98a));
  ring.position.y = 0.006;
  g.add(ring);

  // The crystal the landing throws out of its own cracks. Flat slivers and not
  // sprites: a camera-facing blob at this size is a round bright dot, and a
  // dozen round bright dots are lens bokeh. They also stay INSIDE the
  // flagstone, which is the lesson ./shardfire.js paid for.
  const shards = [];
  // SMALL and MANY. At 0.16-0.34 they were fifteen dark crimson polygons the
  // size of a thumbnail tumbling over the card's art — confetti, and it hid
  // the fighter on the one frame it has to be read. They are also mostly the
  // bright end of the palette now: a dark chip on a pale card is a blotch,
  // where a lit one is a piece of crystal.
  for (let i = 0; i < 22; i++) {
    const s = rnd(0.1, 0.22);
    const m = plate(shardTex(i % 2), s, s, 5);
    m.position.y = 0.01;
    g.add(m);
    const a = (i / 22) * Math.PI * 2 + rnd(-0.32, 0.32);
    shards.push({
      mesh: m,
      dx: Math.cos(a), dz: Math.sin(a),
      // Out PAST the card and no further. Short of 0.87 they land underneath
      // the fighter and are never seen again; past 1.2 they are lying on the
      // next square, which is the litter ./shardfire.js had to be rebuilt to
      // stop making.
      reach: rnd(0.94, TILE * 0.47),
      spin: rnd(-7, 7),
      turn: rnd(0, Math.PI),
      hot: 0.42 + (i % 3 === 0 ? 0.45 : 0) + rnd(0, 0.12),
      lag: rnd(0, 0.05),
    });
  }

  const c = new THREE.Color();

  // A short, LOW light. shardfire's are deliberately smaller than the gap to
  // the next square so a chain lights six squares and not the board; this one
  // fires once, so it can be a touch stronger, but the reach still stops
  // inside the tile.
  // A metre up rather than a hand's breadth: at 0.42 the decay put a blown
  // white-pink hotspot in the middle of the card's own art on the frame it
  // landed, which is the one frame the fighter has to be legible on.
  kit.after(HIT * SPAN, () => kit.light(new THREE.Vector3(p.x, 1.0, p.z), 0xff3a72,
    { power: 7, seconds: 0.34, reach: 3.2 }));

  kit.hold(g, SPAN, (t) => {
    const run = clamp01(t / HIT);
    const after = clamp01((t - HIT) / (1 - HIT));

    /* ---- the fractures, running out from nothing ---- */
    for (const k of cracks) {
      const grow = smooth((run - k.wake) / (0.62 * k.rate));
      k.mesh.scale.set(Math.max(0.001, grow), 1, 1);
      // Dark all through, and the hairline down the middle of it takes the
      // faction's colour — dim while the stone is only failing, and white-hot
      // for a tenth of a second when the thing actually lands on it.
      const flare = Math.exp(-Math.abs(t - HIT) * 26);
      c.copy(COLD).lerp(HOT, clamp01(flare * 1.25));
      k.mesh.material.color.copy(c);
      k.mesh.material.opacity = Math.min(1, grow * 2.5)
        * (0.7 + 0.3 * flare) * (1 - smooth((after - 0.5) / 0.5));
    }

    /* ---- the landing ---- */
    const blown = smooth(after / 0.34);
    ring.scale.setScalar(0.34 + blown * 1.12);
    // It fades as it spreads AND it never leaves the flagstone: grit thrown
    // two squares is litter, and this board is nine squares wide.
    ring.material.opacity = 0.85 * Math.sin(Math.PI * clamp01(after / 0.42)) ** 0.8;

    for (const s of shards) {
      const k = clamp01((after - s.lag) / 0.3);
      // Out fast and stopping dead, the way a chip of stone does — it has no
      // momentum to speak of and the flagstone is not slippery.
      const d = s.reach * (1 - (1 - k) ** 3);
      s.mesh.position.set(s.dx * d, 0.01 + 0.21 * Math.sin(Math.PI * clamp01(k * 1.4)),
        s.dz * d);
      s.mesh.rotation.z = s.turn + s.spin * k * 0.5;
      c.copy(DEEP).lerp(HOT, s.hot);
      s.mesh.material.color.copy(c);
      s.mesh.material.opacity = Math.min(1, k * 6) * (1 - smooth((after - 0.5) / 0.5));
    }

    /* ---- what is left ---- */
    // It arrives WITH the impact rather than growing in: the stone is either
    // marked or it is not.
    bruise.material.opacity = 0.62 * smooth(after / 0.06) * (1 - smooth((after - 0.6) / 0.4));
    bruise.scale.setScalar(0.86 + after * 0.1);
  });
}
