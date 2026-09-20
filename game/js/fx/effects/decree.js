// AN EDICT crossing the whole board and changing what is allowed.
//
// Shared by 3 cards: The Everking's Decree (C079), Hallowed Ground (M069) and
// Soulbound Gargoyle (M066). One motif, one file.
//
// Nothing dies here. A RULE changes, and it goes on applying afterwards — so
// the shape cannot be a projectile or a blast. Every other motif on this table
// travels from a caster to a victim; this one is about the GROUND. What it
// does is RULE the board: a seal is pressed on the card that spoke, the joints
// between the flagstones go dark, and cold violet light runs out along them
// the way water follows a channel — knotting at each crossing, standing the
// seams up as low walls, closing a rim on every fighter it passes. Then the
// walls sink and the lines stay in the stone, dimming — the law written down,
// not taken back.
//
// That is why everything here is rectilinear and travels at a CONSTANT speed.
// Easing the front out makes it a shockwave; radiating it from a point makes
// it a blast. A decree is unhurried and it respects the grid, because the grid
// is what it is about.
//
// It also has to stay quieter than a kill. The brightness is bought with dark
// rather than with power: a shadow falls over the field first, and the lines
// are then cold light in near-black instead of yet more glare over lit stone.
//
// This one is judged on FULL-FRAME shots, not crops — it is the only motif
// here whose subject is the whole board.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=400" \
//             --eval tools/fxdemo/decree.js --out /tmp/d-400.png --settle 900
// &fxsq picks the square it is cast from and &fxzoom looks closely; see the
// harness, which also explains why wall-clock --settle cannot say WHEN a shot
// was taken.

import { THREE, CARD_W, easeOut, easeInOut } from '../kit.js';
import { STEP, TILE } from '../../arena.js';

/* ------------------------------------------------------------ geometry */

// The lattice is the board's own masonry, not a drawn overlay. The joints
// between slabs sit halfway between two centres, and the outer boundary of
// the nine squares is half a tile beyond the outer row.
const SEAM = STEP / 2;              // 1.31 — the inner joints
const EDGE = STEP + TILE / 2;       // 3.87 — the edge of jurisdiction
const RAILS = [-EDGE, -SEAM, SEAM, EDGE];
const M = 26;                       // samples along each of the 8 rails

// The flagstone face is at y=0.080 and the slabs are jittered a little wider
// than nominal, so a line exactly on the joint still overlaps stone. These
// clear it without floating, and are stacked so the spill never z-fights the
// core it sits under.
const STAIN_Y = 0.092;
const GROOVE_Y = 0.098;
const SPILL_Y = 0.103;
const GY = 0.109;
const LINE_W = 0.17;                // the core; ~6px at the game's camera
const SPILL_W = 0.74;               // how far the joint lights the stone
const GROOVE_W = 1.15;              // the dark channel the light lies in
const WALL_H = 0.66;                // how far the seams stand up

/* ------------------------------------------------------------ timeline */

// kit.hold hands the tick a FRACTION, so every moment below is a fraction and
// SPAN is the only number in seconds. This is a rare card and the motif has to
// cross the whole board, so it is allowed to be long — but the loud part is
// only the middle third.
const SPAN = 1.55;
const RUN0 = 0.05, RUN1 = 0.42;     // the writ running along the joints
                                    // (normalised: a cast from a corner has
                                    // nearly twice as far to go and must still
                                    // take the same time, so the front is a
                                    // little faster from there)
const EBB0 = 0.44, EBB1 = 0.86;     // the slow second pass, settling
const WALL_DN = 0.62, WALL_OUT = 0.86;
const FADE = 0.70;                  // the lines dimming, to the end

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold disposes materials and a material
// never disposes its map.
const CACHE = {};
function cached(key, make) {
  if (!CACHE[key]) CACHE[key] = make();
  return CACHE[key];
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Across a ground ribbon: a bright core with no edge of its own. */
const bandTexture = () => cached('band', () => canvas(4, 64, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.30, 'rgba(255,255,255,0.30)');
  grd.addColorStop(0.46, 'rgba(255,255,255,1)');
  grd.addColorStop(0.54, 'rgba(255,255,255,1)');
  grd.addColorStop(0.70, 'rgba(255,255,255,0.30)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 64);
}));

/** The spill of the same light onto the stone either side of the joint. A
 *  line with no spill is a vector, and eight of those are a debug grid — this
 *  is what makes the STONE look lit rather than drawn on. */
const spillTexture = () => cached('spill', () => canvas(4, 64, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.24, 'rgba(255,255,255,0.10)');
  grd.addColorStop(0.42, 'rgba(255,255,255,0.46)');
  grd.addColorStop(0.50, 'rgba(255,255,255,0.62)');
  grd.addColorStop(0.58, 'rgba(255,255,255,0.46)');
  grd.addColorStop(0.76, 'rgba(255,255,255,0.10)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 64);
}));

/** Up a wall: dense at the joint, gone by the top, so it is light standing up
 *  out of the stone rather than a fence panel. */
const riseTexture = () => cached('rise', () => canvas(4, 128, (g) => {
  // THREE flips textures, so uv.y=0 (the base of the wall) is the BOTTOM of
  // the canvas — hence the opaque end is stop 1.
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.38, 'rgba(255,255,255,0.12)');
  grd.addColorStop(0.72, 'rgba(255,255,255,0.46)');
  grd.addColorStop(0.93, 'rgba(255,255,255,0.92)');
  grd.addColorStop(1.00, 'rgba(255,255,255,1)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
}));

/** The shadow that falls over the field. A ROUNDED SQUARE, not a disc: a
 *  circular vignette on a square board reads as a spotlight, and the first
 *  version of this looked like somebody had turned the braziers down. */
const washTexture = () => cached('wash', () => canvas(256, 256, (g) => {
  g.fillStyle = '#000';
  for (let i = 0; i <= 40; i++) {
    // built as forty nested rounded rects, which is a cheap way to get a
    // feathered edge on a shape a radial gradient cannot make
    const k = i / 40;
    const inset = 128 * (1 - k);
    const a = k < 0.62 ? 0.90 : 0.90 * (1 - (k - 0.62) / 0.38) ** 1.6;
    g.globalAlpha = a / 14;
    const r = 26 * (1 - k * 0.4);
    g.beginPath();
    g.roundRect(128 - inset, 128 - inset, inset * 2, inset * 2, Math.max(1, r));
    g.fill();
  }
  g.globalAlpha = 1;
  // a violet bias, so what it takes away is warmth rather than colour
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#12061f';
  g.fillRect(0, 0, 256, 256);
}));

/** The stain a ruled square takes: soft, square, no edge of its own.
 *
 *  It DARKENS. The version before this one was an additive violet glow, and
 *  nine of those plus the lattice turned the whole courtyard lavender — a
 *  brighter board than before the edict, which is the wrong direction for a
 *  faction whose colour runs to near-black and far too loud for a card on
 *  which nothing died. Dark on the squares is also what makes the joints read
 *  as cracks of light rather than as drawn lines. */
const stainTexture = () => cached('stain', () => canvas(128, 128, (g) => {
  for (let i = 0; i <= 26; i++) {
    const k = i / 26;
    const inset = 64 * (1 - k);
    g.globalAlpha = (k < 0.5 ? 1 : (1 - (k - 0.5) / 0.5) ** 1.4) / 9;
    g.fillStyle = '#ffffff';
    g.fillRect(64 - inset, 64 - inset, inset * 2, inset * 2);
  }
}));

/** The seal pressed on the card that spoke: a SQUARE with its corners cut,
 *  because every other mark on this table is a ring and law is rectilinear.
 *
 *  The first version was a 6px stroke on a 128px canvas, which at the game's
 *  camera is a CARD 63 PIXELS WIDE and a stroke of three — invisible, and for
 *  two rounds of screenshots the motif looked as though it came from nowhere.
 *  The stroke here is a tenth of the mark, the same lesson the gate brands on
 *  the flagstones already teach: wide and thin beats narrow and fine. */
const sealTexture = () => cached('seal', () => canvas(128, 128, (g) => {
  g.strokeStyle = '#ffffff';
  g.lineJoin = 'miter';
  const cut = 22;
  g.lineWidth = 13;
  g.beginPath();
  for (const [x, y] of [[cut, 8], [128 - cut, 8], [120, cut], [120, 128 - cut],
    [128 - cut, 120], [cut, 120], [8, 128 - cut], [8, cut]]) g.lineTo(x, y);
  g.closePath();
  g.stroke();
  g.lineWidth = 4;
  g.strokeRect(30, 30, 68, 68);
}));

/** The binding on a fighter: a cold rim hugging the edge of its card.
 *
 *  This replaced a smaller seal stamped on each fighter, which could not be
 *  made to work: a card is 63 screen pixels wide, so a mark inside it is a
 *  smudge, and a mark the size of the card lands exactly on the card's own
 *  printed border and disappears into it. A rim sitting just OUTSIDE the edge
 *  has the dark stone to be seen against, which is the only clean contrast a
 *  card-sized mark has available.
 *
 *  It falls off faster inwards than outwards so it never dims the art. */
const rimTexture = () => cached('rim', () => canvas(128, 128, (g) => {
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1;
  for (let r = 63; r >= 2; r--) {
    const d = r - 48;
    const a = Math.exp(-((d / (d > 0 ? 11 : 6)) ** 2));
    if (a < 0.015) continue;
    g.globalAlpha = a;
    g.strokeRect(64 - r + 0.5, 64 - r + 0.5, 2 * r - 1, 2 * r - 1);
  }
}));

/** A junction stone: where two joints cross, the light knots. Sixteen of
 *  these give the lattice a RHYTHM as the writ arrives — without them the
 *  eight rails all light at once along their length and the board reads as a
 *  wireframe switching on rather than as ground being surveyed. */
const nodeTexture = () => cached('node', () => canvas(64, 64, (g) => {
  const arm = (w, l, a) => {
    g.globalAlpha = a;
    g.fillStyle = '#ffffff';
    g.fillRect(32 - w, 32 - l, w * 2, l * 2);
    g.fillRect(32 - l, 32 - w, l * 2, w * 2);
  };
  arm(2.6, 26, 0.5);
  arm(4.5, 15, 0.7);
  g.globalAlpha = 1;
  g.beginPath(); g.arc(32, 32, 5.5, 0, Math.PI * 2); g.fill();
}));

/* ------------------------------------------------------------ the lattice */

/**
 * The eight rails, sampled, with the moment each sample lights.
 *
 * The front spreads by MANHATTAN distance from the card, not straight-line
 * distance: on a lattice the two are the same to within the width of a joint,
 * and Manhattan is what makes the front travel ALONG the channels instead of
 * sweeping over them as a circle would. The nearest samples are the midpoints
 * of the source square's own four sides, so the square the card is standing on
 * is ruled first and the rest of the board follows — which is literally what
 * Hallowed Ground says.
 */
function rails(src) {
  const pts = [];
  const starts = [];
  for (let axis = 0; axis < 2; axis++) {
    for (const u of RAILS) {
      starts.push(pts.length);
      for (let i = 0; i < M; i++) {
        const v = -EDGE + (i / (M - 1)) * 2 * EDGE;
        const x = axis === 0 ? v : u;
        const z = axis === 0 ? u : v;
        // The light POOLS at the crossings and thins between them. Eight rails
        // of even brightness are a wireframe however carefully they are
        // coloured; knotting them where the joints meet is what turns the same
        // eight lines into something INSCRIBED, and it gives the front
        // something to arrive at rather than a smooth sweep along a tube.
        let near = EDGE;
        for (const c of RAILS) near = Math.min(near, Math.abs(v - c));
        const knot = 0.70 + 0.52 * Math.exp(-((near / 0.78) ** 2));
        // The four OUTER rails carry more weight than the four inner joints.
        // Eight identical lines are a grid; a heavier boundary with lighter
        // divisions inside it is a JURISDICTION, and it gives the picture a
        // hierarchy to read instead of nine equal cells.
        const bound = Math.abs(u) > EDGE - 0.01 ? 1.30 : 1;
        pts.push({
          x, z,
          px: axis === 0 ? 0 : 1,          // across the rail
          pz: axis === 0 ? 1 : 0,
          d: Math.abs(x - src.x) + Math.abs(z - src.z),
          // light running in a crack is not even either
          jit: knot * bound * (0.82 + Math.random() * 0.18),
          tall: bound,
        });
      }
    }
  }
  let dmax = 0;
  for (const p of pts) if (p.d > dmax) dmax = p.d;
  for (const p of pts) p.a = p.d / dmax;
  return { pts, starts, dmax };
}

/** A quad strip over the sampled rails, with a colour per vertex. */
function strip(pts, starts, map) {
  const n = pts.length;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const uv = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    uv[i * 4 + 0] = 0; uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = 0; uv[i * 4 + 3] = 1;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (const s of starts) {
    for (let i = 0; i < M - 1; i++) {
      const a = (s + i) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

/** Lay a strip flat in the stone, once — the ground parts never move. */
function layFlat(mesh, pts, width, y) {
  const a = mesh.geometry.attributes.position.array;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i], w = width * 0.5;
    a[i * 6 + 0] = q.x - q.px * w; a[i * 6 + 1] = y; a[i * 6 + 2] = q.z - q.pz * w;
    a[i * 6 + 3] = q.x + q.px * w; a[i * 6 + 4] = y; a[i * 6 + 5] = q.z + q.pz * w;
  }
  mesh.geometry.attributes.position.needsUpdate = true;
}

// Cold light: the red channel is held well down and the blue kept up. Additive
// violet through the arena's filmic tone mapping goes white the moment it is
// pale, and the version before this one ran the red at 1.05 and came out MAGENTA
// — a hot colour on a board whose whole point is that nothing was burned.
const HEAD = [0.46, 0.20, 1.52];     // the front, as it passes
const TRAIL = [0.075, 0.022, 0.42];  // what it leaves in the joint

export function decree(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const g = new THREE.Group();
  const { pts, starts, dmax } = rails(p);

  // The groove the light lies in. This is the difference between an engraved
  // line and a neon tube: the first version was a fat additive glow on lit
  // stone and read as a sign switched on. Darkening the joint FIRST and then
  // running a hairline down the middle of it buys the contrast with shadow
  // instead of with power, which is the whole budget of this motif.
  const groove = strip(pts, starts, spillTexture());
  groove.material.blending = THREE.NormalBlending;
  groove.material.vertexColors = false;
  groove.material.color.setHex(0x080311);
  groove.material.opacity = 0;
  groove.material.needsUpdate = true;
  layFlat(groove, pts, GROOVE_W, GROOVE_Y);

  const spill = strip(pts, starts, spillTexture());
  const ground = strip(pts, starts, bandTexture());
  const wall = strip(pts, starts, riseTexture());
  layFlat(spill, pts, SPILL_W, SPILL_Y);
  layFlat(ground, pts, LINE_W, GY);
  {
    const b = wall.geometry.attributes.position.array;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      b[i * 6 + 0] = q.x; b[i * 6 + 1] = GY; b[i * 6 + 2] = q.z;
      b[i * 6 + 3] = q.x; b[i * 6 + 4] = GY; b[i * 6 + 5] = q.z;
    }
  }

  // The shadow. Above the cards, so the fighters go dark under the edict too —
  // it is THEM the rule is about. Normal-blended and near-black: a violet this
  // wide added to the scene would light the whole battlefield.
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(EDGE * 2.55, EDGE * 2.55),
    new THREE.MeshBasicMaterial({
      map: washTexture(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  wash.rotation.x = -Math.PI / 2;
  wash.position.y = 0.285;
  g.add(wash, groove, spill, ground, wall);

  // The stain on each ruled square. It lies UNDER the cards rather than over
  // them — the apron of bare stone around a card is only a third of a metre
  // wide but it is the part that belongs to the square, and staining the card
  // itself would bury the art of six fighters at once.
  const stains = [];
  const stainMap = stainTexture();
  for (let i = 0; i < 9; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.99, TILE * 0.99),
      new THREE.MeshBasicMaterial({
        map: stainMap, color: 0x0b0418, transparent: true, opacity: 0,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set((col - 1) * STEP, STAIN_Y, (1 - row) * STEP);
    // a square is claimed when the front has been all the way ROUND it, which
    // is its centre's distance plus the half-square the front still has to
    // travel to close the far corner
    m.userData.a = Math.min(1, (Math.abs(m.position.x - p.x)
      + Math.abs(m.position.z - p.z) + SEAM * 2) / dmax);
    stains.push(m);
    g.add(m);
  }

  // The junction stones, at the sixteen crossings of the lattice.
  const nodes = [];
  const nodeMap = nodeTexture();
  for (const ux of RAILS) {
    for (const uz of RAILS) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.86, 0.86),
        new THREE.MeshBasicMaterial({
          map: nodeMap, color: 0x8a52ff, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(ux, GY + 0.004, uz);
      m.userData.a = (Math.abs(ux - p.x) + Math.abs(uz - p.z)) / dmax;
      nodes.push(m);
      g.add(m);
    }
  }

  // The marks. A seal is pressed on the card that spoke, and then a cold rim
  // closes on EVERY fighter the lattice reaches, as it reaches it.
  //
  // This is the half of the motif that says what a decree is FOR. Without it
  // the board lit up and the fighters standing on it were untouched bystanders
  // — pretty, but it could have been any board effect at all. A rule that
  // binds everyone has to be seen landing on everyone.
  const marks = [];
  const mark = (map, pos, { size, colour, hot, hold, a }) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map, color: colour, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    // kit.at answers 0.4 for a BARE square and about 0.2 for a card, so a mark
    // laid at the raw height either floats a fifth of a unit over empty stone
    // — Hallowed Ground names a square, and often an empty one — or sinks into
    // an occupied one.
    m.position.set(pos.x, pos.y > 0.3 ? 0.138 : Math.min(pos.y, 0.225) + 0.055, pos.z);
    m.userData = { hot, hold, a };
    marks.push(m);
    g.add(m);
  };
  mark(sealTexture(), p, {
    size: CARD_W * 0.66, colour: 0xa878ff, hot: 1.0, hold: 0.46, a: 0,
  });
  const rimMap = rimTexture();
  for (let i = 0; i < 9; i++) {
    const piece = kit.pieces?.topAt?.(i);
    if (!piece) continue;
    const q = piece.group.position;
    const own = Math.abs(q.x - p.x) < 0.01 && Math.abs(q.z - p.z) < 0.01;
    mark(rimMap, q, {
      size: CARD_W * 1.32, colour: 0x8f55ff,
      hot: own ? 0.86 : 0.60, hold: own ? 0.44 : 0.30,
      a: own ? 0 : Math.min(1,
        (Math.abs(q.x - p.x) + Math.abs(q.z - p.z) + SEAM) / dmax),
    });
  }

  kit.light(p, 0x6a34d4, { power: 7, seconds: 0.55, reach: 5.5 });

  const sc = spill.geometry.attributes.color.array;
  const gc = ground.geometry.attributes.color.array;
  const wc = wall.geometry.attributes.color.array;
  const wp = wall.geometry.attributes.position.array;
  const put = (arr, i, r, gg, b) => {
    arr[i * 6 + 0] = arr[i * 6 + 3] = r;
    arr[i * 6 + 1] = arr[i * 6 + 4] = gg;
    arr[i * 6 + 2] = arr[i * 6 + 5] = b;
  };

  kit.hold(g, SPAN, (t) => {
    // Constant speed. Anything eased here reads as a shockwave.
    const run = Math.max(0, Math.min(1, (t - RUN0) / (RUN1 - RUN0)));
    // and then a SECOND, much slower pass over the same ground. Without it the
    // middle half-second of the motif was a frozen picture — the writ had
    // arrived everywhere and nothing moved again until the fade. This is the
    // law settling rather than arriving, so it is broad, dim and unhurried.
    const ebb = (t - EBB0) / (EBB1 - EBB0);
    // easeInOut, not easeIn: a cubic ease-IN is steepest at its END, so the
    // shadow lifted off the whole battlefield in the last eighth of a second
    // and the motif finished with a visible POP back to daylight.
    const fade = 1 - easeInOut(Math.max(0, (t - FADE) / (1 - FADE)));
    const sink = 1 - easeInOut(Math.max(0, Math.min(1,
      (t - WALL_DN) / (WALL_OUT - WALL_DN))));

    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      const age = run - q.a;
      if (age <= 0) {
        put(sc, i, 0, 0, 0); put(gc, i, 0, 0, 0); put(wc, i, 0, 0, 0);
        wp[i * 6 + 4] = GY;
        continue;
      }
      const flare = Math.exp(-((age / 0.075) ** 2));
      const swell = ebb <= 0 ? 0 : Math.exp(-(((ebb - q.a) / 0.34) ** 2)) * 0.85;
      const on = Math.min(1, age / 0.03) * q.jit * fade;
      const lvl = on * (1 + swell);
      const r = (TRAIL[0] + (HEAD[0] - TRAIL[0]) * flare) * lvl;
      const gg = (TRAIL[1] + (HEAD[1] - TRAIL[1]) * flare) * lvl;
      const b = (TRAIL[2] + (HEAD[2] - TRAIL[2]) * flare) * lvl;
      put(gc, i, r, gg, b);
      put(sc, i, r * 0.20, gg * 0.16, b * 0.24);

      // The wall follows the front up a beat behind it, so the board is fenced
      // in the order it was ruled.
      const up = easeOut(Math.min(1, Math.max(0, (age - 0.04) / 0.22))) * sink;
      wp[i * 6 + 4] = GY + WALL_H * q.tall * up;
      const w = lvl * up;
      put(wc, i, 0.29 * w, 0.095 * w, 0.92 * w);
    }
    spill.geometry.attributes.color.needsUpdate = true;
    ground.geometry.attributes.color.needsUpdate = true;
    wall.geometry.attributes.color.needsUpdate = true;
    wall.geometry.attributes.position.needsUpdate = true;

    for (const m of nodes) {
      const k = run - m.userData.a;
      if (k <= 0) { m.material.opacity = 0; continue; }
      const knot = Math.exp(-((k / 0.055) ** 2));
      m.material.opacity = (0.30 + 0.85 * knot) * fade;
      m.scale.setScalar(1 + knot * 0.55);
    }

    for (const m of stains) {
      const k = Math.min(1, Math.max(0, (run - m.userData.a) / 0.18));
      m.material.opacity = 0.62 * easeOut(k) * fade;
    }

    const dark = easeOut(Math.min(1, t / 0.12))
      * (1 - easeInOut(Math.max(0, (t - 0.72) / 0.28)));
    wash.material.opacity = 0.78 * dark;
    groove.material.opacity = 0.95 * dark;

    // The seal is PRESSED: it comes down out of scale rather than expanding
    // out of nothing, which is what every ring on this table already does.
    // A mark is PRESSED: it comes down out of scale rather than expanding out
    // of nothing, which is what every ring on this table already does. Hot as
    // it bites, then a steady mark for as long as the law stands.
    for (const m of marks) {
      const u = m.userData;
      const k = run - u.a;
      if (k < 0 && u.a > 0) { m.material.opacity = 0; continue; }
      const bite = u.a > 0 ? Math.min(1, k / 0.05) : Math.min(1, t / 0.06);
      const cool = easeOut(Math.min(1, Math.max(0, (bite >= 1 ? 1 : 0)
        * (u.a > 0 ? (k - 0.05) / 0.12 : (t - 0.06) / 0.14))));
      m.scale.setScalar(1.62 - easeOut(bite) * 0.62);
      m.material.opacity = u.hot * bite * (1 - (1 - u.hold) * cool) * fade;
    }
  });
}
