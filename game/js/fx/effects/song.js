// SONG — a chorus made visible.
//
// Shared by 4 cards: M029 Aria of Aggression, M031 Coercive Cantata,
// M068 Dirge of Deconstruction, M087 Deckhand Drifter. All four work the same
// way: you FATIGUE any number of your own power-I fighters, those fighters are
// Singing, and the strength of the card is HOW MANY of them sang. So this is
// the one motif on the table that is not about a card — it is about a CHORUS,
// and its job is to show you who gave voice and how many.
//
// So the shape is a HARP. A string of light arches from every Singer to the
// card that resolved and VIBRATES as a standing wave — short lobes, still
// points between them, brightest where it is not moving. The voices come in
// one at a time, each on a wavelength of its own, and then pull onto a shared
// one: four different quivers becoming one is what a chorus finding unison
// looks like from above. The chord lands, every string flashes and goes
// slack, and the song is DRAWN IN — each string lets go of its Singer and
// runs down the arch into the card, which is left ringing: the interference
// figure of those particular voices, standing on the stone of its square.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=700" \
//             --eval tools/fxdemo/song.js --out /tmp/song.png --settle 500 --wait 8000
// ?t is milliseconds INTO the motif (see the harness) — wall-clock --settle
// lands wherever the frame rate feels like on the day.

import { THREE, FACTION } from '../kit.js';

/* ------------------------------------------------------------ the clock */

// Seconds, and they are phase BOUNDARIES rather than durations. kit.hold hands
// the tick a fraction of the span, so the tick multiplies back up by SPAN and
// everything below is read in the same units it was written in.
const SPAN = 1.55;
const JOIN = 0.02;        // the first voice
const GAP = 0.075;        // between voices — a chorus does not start as one
const TRAVEL = 0.26;      // a voice reaching across to the card
const UNISON = 0.62;      // the voices start pulling onto one wavelength
const STRIKE = 0.88;      // the chord lands
const DRAWN = 1.18;       // the last of the song has been drawn into the card

/* ----------------------------------------------------------- the colour */

// BLUE-GREEN, and held down. The first pass ran the cords near white and hot,
// and additive white over a card is a hole in the board: at the climax the
// card that resolved was a featureless white blob with a white smear standing
// on it. Everything here now sits well under 1 in every channel, the pale end
// is only ever reached by the head of a travelling voice, and the renderer's
// ACES tone map — which walks anything bright towards white — never gets the
// chance to bleach the teal out of it.
const PALE = new THREE.Color(0xbdf2ff);
const VOICE = new THREE.Color(0x5ce8cf);
const SEA = new THREE.Color(0x2fb4dd);

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

/* --------------------------------------------------------- the textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map. The interference figure is NOT in here — it is built
// from the real positions of the real Singers, so it is per-cast and is thrown
// away by hand when the motif ends.
const TEXES = new Map();
function tex(key, paint, w = 128, h = 128) {
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

/** Read ACROSS a strip, which is what v is. */
function across(stops) {
  return (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    for (const [at, a] of stops) grd.addColorStop(at, `rgba(255,255,255,${a})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  };
}

/** The string itself: one soft core, so a narrow strip still glows. */
const lineTex = () => tex('line', across([
  [0, 0], [0.22, 0.10], [0.40, 0.72], [0.5, 1], [0.60, 0.72], [0.78, 0.10], [1, 0],
]), 8, 128);

/** A soft round speck, for the motes and the bloom under a Singer. */
const blobTex = () => tex('blob', (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.62)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, w);
}, 64, 64);

/**
 * The interference figure the chord leaves on the square — the actual
 * standing wave of the actual Singers, not a drawn ornament: one plane wave
 * per voice, running in from the direction that voice is really in, summed.
 * Two Singers make bands, four make a lattice, and the figure therefore COUNTS
 * the chorus, which is the number every one of these cards turns on.
 *
 * The wavelength is deliberately coarse. Fine fringes are the physically
 * honest answer and they are useless here: a card is sixty screen pixels wide,
 * so anything under half a world unit sampled down to that size is grey noise.
 * At 0.62 the square carries four or five, which survives being small.
 */
const LAMBDA = 0.62;
function figureTex(dirs, R) {
  const S = 192;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  const K = (Math.PI * 2) / LAMBDA;
  const n = Math.max(1, dirs.length);
  for (let py = 0; py < S; py++) {
    const z = (py / (S - 1) - 0.5) * 2 * R;
    for (let px = 0; px < S; px++) {
      const x = (px / (S - 1) - 0.5) * 2 * R;
      let sum = 0;
      for (let i = 0; i < dirs.length; i++) sum += Math.cos(K * (x * dirs[i].x + z * dirs[i].z));
      const a = Math.abs(sum) / n;
      let v = sstep(0.52, 0.90, a);                  // the antinodes only
      // Hollow in the middle. Drawn solid across the card the figure was a
      // wash and nothing else — half the fighters in the game have pale art,
      // and additive colour on near-white paint only clips to white and takes
      // the card's own picture with it. Squeezed into the thin ring of stone
      // outside the card it was a halo, which is a UI highlight. Faded in over
      // the middle of the card and held to the rim of the square, most of the
      // antinodes land on dark stone and read as what they are: a dozen
      // separate blobs at the spacing the voices put them there, which moves
      // when a Singer moves.
      const rr = Math.hypot(x, z) / R;
      v *= sstep(0.28, 0.66, rr) * sstep(1.02, 0.86, rr);
      const o = (py * S + px) * 4;
      d[o] = 112; d[o + 1] = 226; d[o + 2] = 214;
      d[o + 3] = (v * 255) | 0;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------ the board */

/** `kit.at` answers 0.4 for a bare square but about 0.20 for a card, whose
 *  face is at ~0.22. Anything flat needs to clear the face or it loses the
 *  depth test and is drawn on the stone AROUND the card but not on it. */
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

/**
 * Who is singing. The Singers are your own fighters, fatigued to give voice,
 * so that is what this looks for — defensively at every step, because a
 * flourish must never take the table down with it.
 *
 * The fallback matters: nothing promises that the fatigue is on the board by
 * the time the flourish plays, and a chorus motif with nobody in it is the one
 * failure that would be obvious. If nothing of yours is fatigued, everyone
 * else on your side is taken to have joined in.
 */
function singers(kit, at) {
  try {
    const self = kit.piece(at);
    const mine = self ? self.owner : null;
    const map = kit.pieces && kit.pieces.byUid;
    if (!map) return [];
    const pick = (wantFatigued) => {
      const got = [];
      for (const q of map.values()) {
        if (!q || q === self || q.isConstruct) continue;
        if (q.square == null || q.square > 8) continue;   // on the board proper
        if (q.depth) continue;                            // top of the stack only
        if (mine != null && q.owner !== mine) continue;
        if (wantFatigued && !(q.card && q.card.fatigued)) continue;
        got.push(q.group.position.clone());
      }
      return got;
    };
    const fat = pick(true);
    return fat.length ? fat : pick(false);
  } catch { return []; }   // never throw
}

/* ----------------------------------------------------------- the string */

const UP = new THREE.Vector3(0, 1, 0);
// 96 and not 48: the lobes are short and at 48 a seven-lobe wave has seven
// segments to a lobe, so the string came out as a zigzag of straight bits.
const SEG = 96;

/** A quad strip with per-vertex RGBA, unlit. The scene's key light is a warm
 *  low sun and a teal surface lit by it goes grey-green, so every colour in
 *  this motif is placed by hand rather than shaded. */
function strip(map, order, additive) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SEG * 8), 4));
  const uv = new Float32Array(SEG * 4);
  for (let i = 0; i < SEG; i++) {
    const u = i / (SEG - 1);
    uv[i * 4] = u; uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = u; uv[i * 4 + 3] = 1;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < SEG - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map, vertexColors: true, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

/** One voice: the arch it takes, the axis its swing opens along, and how long
 *  it is. None of it changes once the string exists, so it is built once. */
function arch(S, T, bow) {
  const pts = [], side = [], axis = [];
  const d = Math.hypot(T.x - S.x, T.z - S.z);
  const h = 0.72 + 0.15 * d;
  const perp = new THREE.Vector3(-(T.z - S.z), 0, T.x - S.x);
  if (perp.lengthSq() < 1e-9) perp.set(1, 0, 0);
  perp.normalize();
  for (let i = 0; i < SEG; i++) {
    const u = i / (SEG - 1);
    const p = new THREE.Vector3(
      S.x + (T.x - S.x) * u,
      S.y + (T.y - S.y) * u + 4 * h * u * (1 - u),
      S.z + (T.z - S.z) * u,
    );
    p.addScaledVector(perp, bow * Math.sin(Math.PI * u));
    pts.push(p);
  }
  for (let i = 0; i < SEG; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(SEG - 1, i + 1)];
    const tan = b.clone().sub(a);
    if (tan.lengthSq() < 1e-9) tan.set(1, 0, 0);
    tan.normalize();
    const s = tan.clone().cross(UP);
    if (s.lengthSq() < 1e-9) s.copy(perp);
    s.normalize();
    side.push(s);
    // The swing LEANS, two parts across the floor to one part up. Flat, the
    // wave is a squiggle drawn on the flagstones with none of the arch left in
    // it. Mostly vertical — which was tried — it went edge-on to the strip's
    // own width and broke into visible stair-steps.
    const n = s.clone().cross(tan).normalize();
    if (n.y < 0) n.negate();
    axis.push(s.clone().multiplyScalar(0.88).addScaledVector(n, 0.44).normalize());
  }
  let len = 0;
  for (let i = 1; i < SEG; i++) len += pts[i].distanceTo(pts[i - 1]);
  return { pts, side, axis, len };
}

/** Write one rib of a strip: a point, and how far the strip reaches either
 *  side of it along `sd`. */
function lay(arr, i, x, y, z, sd, w) {
  arr[i * 6] = x - sd.x * w; arr[i * 6 + 1] = y - sd.y * w;
  arr[i * 6 + 2] = z - sd.z * w;
  arr[i * 6 + 3] = x + sd.x * w; arr[i * 6 + 4] = y + sd.y * w;
  arr[i * 6 + 5] = z + sd.z * w;
}

/* -------------------------------------------------------------- the cast */

const LW = 0.053;         // the cord itself
const HW = 0.17;          // the glow around it
const A_MANY = 0.17;      // swing while the voices are still separate
const A_ONE = 0.27;       // swing once they are in unison

// Modes are set by WAVELENGTH, not by a fixed lobe count, because the arches
// are not the same length — a diagonal reaches half again as far as a straight
// one — and three lobes on each means two different pitches that never sound
// like one chorus. Each voice starts on a wavelength of its own and they all
// end on WL_ONE, which is what being in tune looks like from above.
//
// And they are SHORT wavelengths with a modest swing. Three great bulges was
// the first shape tried and it read as a wandering wire: a lazy meander on an
// already-curved arch is not a vibration, it is just a bend.
const WL_MANY = [0.52, 0.86, 0.66, 1.02, 0.60, 0.76];
const WL_ONE = 0.62;
const mode = (len, wl) => Math.max(2, Math.round(len / wl));

/**
 * Nothing this card kills may fall before the chord that killed it lands.
 * fx.js reads this; without it the wait is zero, and a Dirge of Deconstruction
 * threw its victim on the pile while the chorus was still assembling — the
 * song happened AFTER the thing it was supposed to have caused.
 */
export const timing = { kill: STRIKE - 0.02 };

export function song(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const T = p.clone().setY(flatY(p));

  const heard = singers(kit, at)
    .map((q) => ({ q, d: q.distanceTo(p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6)
    .map((e) => e.q);

  const g = new THREE.Group();
  const voices = [];
  const dirs = [];

  heard.forEach((s0, i) => {
    const S = s0.clone().setY(flatY(s0));
    if (S.distanceTo(T) < 0.5) return;
    const bow = ((i % 2) ? 0.12 : -0.12) * (1 + (i % 3) * 0.4);
    const path = arch(S, T, bow);
    // Two strips: a wide dim glow and a narrow solid cord on top of it.
    //
    // The cord is NOT additive, which is the one decision that made this motif
    // blue-green instead of white. Additive light sums past 1 in green and
    // blue, and the renderer's ACES tone map pulls a third of the green
    // channel into red on the way out, so every bright cyan cord this was
    // tried with arrived on screen as grey string. Composited normally the
    // cord is exactly the colour it was given. The glow around it is additive,
    // because that is what a glow is, and it is dim enough not to bleach.
    //
    // An earlier pass drew a third and fourth strip at the two extremes of the
    // swing, the textbook standing-wave diagram. At sixty pixels a card three
    // lines of similar weight are a braided cable, not a string and its
    // afterimage; the wave shape and the bright nodes carry it alone.
    const halo = strip(lineTex(), 6, true);
    const line = strip(lineTex(), 7, false);
    g.add(halo); g.add(line);

    // A bloom on the Singer's own card, so the chorus is not a set of lines
    // arriving from nowhere — you can see which fighters paid for it.
    const bloom = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35),
      new THREE.MeshBasicMaterial({
        map: blobTex(), color: VOICE, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
    bloom.rotation.x = -Math.PI / 2;
    bloom.position.copy(S);
    bloom.renderOrder = 5;
    g.add(bloom);

    voices.push({ halo, line, bloom, path,
      t0: JOIN + i * GAP,
      n: mode(path.len, WL_MANY[i % WL_MANY.length]),
      n1: mode(path.len, WL_ONE),
      ph: i * 1.9 });
    const v = new THREE.Vector3().subVectors(S, T);
    v.y = 0;
    dirs.push(v.normalize());
  });

  // The figure, drawn a little wider than the whole square so its outer
  // antinodes land on the dark stone the card sits in rather than on the
  // card's own painted face.
  //
  // With nobody else singing, the card is alone with its own voice: two plane
  // waves crossed at a shallow angle, which is the simplest standing wave
  // there is and still an honest one.
  const FIG = 2.5;
  const ALONE = [new THREE.Vector3(0.26, 0, 0.97), new THREE.Vector3(-0.26, 0, 0.97)];
  const fig = new THREE.Mesh(new THREE.PlaneGeometry(FIG, FIG),
    new THREE.MeshBasicMaterial({
      map: figureTex(dirs.length ? dirs : ALONE, FIG / 2),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
  fig.rotation.x = -Math.PI / 2;
  fig.position.copy(T);
  fig.renderOrder = 5;
  g.add(fig);

  const motes = new THREE.Group();
  const mv = [];
  for (let i = 0; i < 17; i++) {
    motes.add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTex(), color: i % 3 ? PALE : VOICE, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })));
    // spread over the square rather than all launched from one point, which
    // stacked every one of them on the middle of the card and burned a white
    // hole through its art
    const a0 = Math.random() * Math.PI * 2;
    mv.push({ a: a0, r: 0.25 + Math.random() * 0.55,
      x: Math.cos(a0) * (0.15 + Math.random() * 0.55),
      z: Math.sin(a0) * (0.15 + Math.random() * 0.55),
      rise: 0.9 + Math.random() * 1.3, s: 0.09 + Math.random() * 0.14,
      t: Math.random() * 0.30 });
  }
  g.add(motes);

  const tint = new THREE.Color();

  kit.hold(g, SPAN, (k) => {
    const s = k * SPAN;
    const uni = sstep(UNISON, STRIKE - 0.05, s);
    const rel = 1 - sstep(STRIKE, STRIKE + 0.12, s);
    // The strings do not fade where they lie. They are DRAWN IN: the far end
    // lets go of the Singer and runs down the arch into the card, so what you
    // watch is the song being swallowed rather than a set of lines dimming on
    // the spot, which is what the first cut of the ending looked like.
    const drain = sstep(STRIKE + 0.02, DRAWN, s);
    const wob = Math.cos(s * 30);
    // the whole harp goes off at once when the chord lands — the travelling
    // pulse alone was a detail nobody could see at sixty pixels a card
    const flash = Math.exp(-(((s - STRIKE) / 0.075) ** 2));
    let landed = 0;                      // a bump each time a voice arrives

    for (const c of voices) {
      const grow = sstep(c.t0, c.t0 + TRAVEL, s);
      const born = clamp((s - c.t0) / 0.09, 0, 1);
      const amp = (A_MANY * (1 - uni) + A_ONE * uni) * rel * born;
      const swing = Math.cos(s * (26 - 7 * uni) + c.ph * (1 - uni));
      landed += Math.exp(-(((s - c.t0 - TRAVEL) / 0.07) ** 2));

      const HP = c.halo.geometry.attributes.position.array;
      const HC = c.halo.geometry.attributes.color.array;
      const LP = c.line.geometry.attributes.position.array;
      const LC = c.line.geometry.attributes.color.array;

      for (let i = 0; i < SEG; i++) {
        const u = i / (SEG - 1);
        const env = Math.abs(Math.sin(c.n * Math.PI * u)) * (1 - uni)
          + Math.abs(Math.sin(c.n1 * Math.PI * u)) * uni;
        const P = c.path.pts[i], sd = c.path.side[i], ax = c.path.axis[i];
        const reach = amp * env * swing;
        // Swung along `ax`, but always WIDE along `sd`: the strip's own width
        // has to stay in the floor plane or the ribbon turns edge-on and the
        // string disappears for half the seats at the table.
        const x = P.x + ax.x * reach, y = P.y + ax.y * reach, z = P.z + ax.z * reach;
        // visible only as far as the voice has reached, with a bright head on
        // the front of it, and a second bright band running the same way when
        // the chord discharges into the card
        let a = 1 - sstep(grow - 0.06, grow + 0.01, u);
        if (drain > 0) a *= sstep(drain - 0.05, drain + 0.02, u);
        a *= sstep(0, 0.05, u) * sstep(1, 0.84, u);
        let hot = grow < 1 ? Math.exp(-(((u - grow) / 0.05) ** 2)) : 0;
        if (drain > 0) hot += Math.exp(-(((u - drain) / 0.05) ** 2));
        hot = clamp(hot + flash * 0.45, 0, 1);
        // The NODES — the places on a standing wave that do not move, and in
        // cymatics the places the sand collects. A bright bead at each one is
        // what stops a wavy cord reading as a wandering wire: a thing with
        // still points on it is vibrating, a thing without them is just bent.
        const knot = Math.exp(-((amp * env / 0.07) ** 2));
        tint.copy(VOICE).lerp(PALE, 0.10 * uni + hot * 0.85 + knot * 0.5);
        // A tremor running along the string toward the card. Without it the
        // cord is evenly lit end to end, which is a rope; sound travels.
        const run = 0.84 + 0.16 * Math.sin(u * 13 - s * 12 + c.ph);
        lay(LP, i, x, y, z, sd, LW * (1 + knot * 0.7));
        lay(HP, i, x, y, z, sd, HW);
        for (let j = 0; j < 2; j++) {
          const n4 = (i * 2 + j) * 4;
          LC[n4] = tint.r * run; LC[n4 + 1] = tint.g * run; LC[n4 + 2] = tint.b * run;
          LC[n4 + 3] = a;
          HC[n4] = SEA.r; HC[n4 + 1] = SEA.g; HC[n4 + 2] = SEA.b;
          HC[n4 + 3] = a * (0.38 + 0.18 * uni + hot * 0.35);
        }
      }
      c.halo.geometry.attributes.position.needsUpdate = true;
      c.halo.geometry.attributes.color.needsUpdate = true;
      c.line.geometry.attributes.position.needsUpdate = true;
      c.line.geometry.attributes.color.needsUpdate = true;
      // The Singer's own card: a breath as the voice starts, then a low glow
      // for as long as it is singing, gone the moment the string lets go.
      const gasp = Math.exp(-(((s - c.t0 - 0.05) / 0.09) ** 2));
      c.bloom.material.opacity = born * (1 - drain)
        * (0.15 + 0.14 * uni + 0.30 * gasp) * (0.86 + 0.14 * wob);
    }

    // The square RINGS. A beaded column of light was stood up on the card
    // here through half a dozen passes and it never once earned its place: a
    // billboard tall enough to see covers the card's own picture, short enough
    // not to is a smudge, and either way it is a beam of light, which is what
    // every other game does. What the chorus leaves behind instead is the
    // standing wave on the stone, pulsing as it dies away — the thing the
    // whole motif has been about, held for a beat where it can be read.
    const ring = 1 - sstep(DRAWN + 0.06, SPAN, s);
    const toll = 0.72 + 0.28 * Math.cos((s - DRAWN) * 34);
    fig.material.opacity = clamp(
      0.09 * sstep(JOIN, UNISON, s) * (1 - drain * 0.5)
      + 0.14 * landed
      + 0.30 * flash
      + 0.38 * Math.exp(-(((s - DRAWN) / 0.07) ** 2))
      + 0.62 * sstep(DRAWN - 0.12, DRAWN, s) * ring * toll, 0, 0.92)
      * (0.88 + 0.12 * Math.cos(s * 40));

    for (let i = 0; i < motes.children.length; i++) {
      const m = motes.children[i], v = mv[i];
      const mt = clamp((s - DRAWN + 0.08 - v.t) / (SPAN + 0.2 - DRAWN), 0, 1);
      m.position.set(T.x + v.x + Math.cos(v.a) * v.r * mt, T.y + 0.05 + v.rise * mt,
        T.z + v.z + Math.sin(v.a) * v.r * mt);
      m.scale.setScalar(v.s * (0.5 + mt));
      m.material.opacity = mt > 0 ? Math.sin(Math.PI * mt) * 0.62 : 0;
    }
  }, () => { fig.material.map.dispose(); });

  // Local, short, and HELD UP OFF THE CARD. A cold light with any reach on it
  // turns the whole battlefield green — the braziers are the only other light
  // there is — and placed on the card face, as it was at first, the inverse
  // square put the light a twentieth of a unit from the thing it was lighting
  // and burned the card's own art to a white patch.
  kit.after(DRAWN - 0.12, () => {
    kit.light(T.clone().setY(T.y + 0.9), FACTION.Marvorren.spark,
      { power: 6 + heard.length * 0.8, seconds: 0.42, reach: 3.4 });
  });
}
