// ENTRANCE — a band strikes up, and every enemy in earshot stops fighting.
//
// One card: R092 Bards-for-Hire. "Replace the abilities of enemy fighters 2 or
// less squares away with 'Entranced: This ability does nothing.' Enemy
// Bards-for-Hire ignore this ability. (They play along instead.)"
//
// Two things make this different from everything else in the folder, and both
// of them are in the rules text rather than in the picture:
//
//   1. It is a FIELD, not a strike. It is true for as long as the Bards stand
//      there and it reaches in every direction, so there is no caster, no
//      victim and no flight between them. What is drawn is the SOUND ITSELF —
//      a continuous train of wavefronts rolling out of the band at a constant
//      speed, one after another for as long as anyone is listening. A single
//      expanding ring is a shockwave; four or five close-packed crests moving
//      together, with a stronger one on every beat, is music.
//   2. The reach is countable. The rules measure distance along the grid's own
//      orthogonal adjacency, so "two squares" is a MANHATTAN two — a DIAMOND,
//      not a circle. Nothing else on this table is diamond-shaped, and the
//      envelope the waves die inside is exactly that diamond. Draw it as a
//      circle and the motif tells a lie about which fighters it caught: from
//      square 3 the far corners are three squares away and out of range, and
//      no circle drawn round square 3 can separate square 1 from square 2 —
//      they are the same distance away as the crow flies.
//
// The victims are DULLED, not damaged. Nothing dies, nothing is thrown. What
// happens to a fighter inside the field is that the field closes OVER it: the
// same wavefronts that are running across the flagstones run across its card
// as well, and the card underneath goes flat and cold. Submerged. The fighters
// who are NOT affected — yours, and the rival band — stand clear of the water
// with their faces dry, which is the one contrast that says at a glance who is
// in and who is out.
//
// And they SWAY. All of them, together, on the beat, while everything the
// field did not touch stays dead square. A charmed crowd rocking in unison is
// what "charmed into uselessness" looks like from above, and it is the only
// part of this motif that can be read at a glance from across the board.
//
// THE JOKE. A rival Bards-for-Hire inside the radius is not silenced — it
// plays along. So it takes no film and no drain: it waits for the next BEAT
// after the sound arrives, and then starts putting out ripples of its own, in
// phase with the ones it is answering (their crests are laid on the total
// distance from the first band, so the two systems interlock instead of
// beating against each other). A second little source of music inside the big
// one, nodding along. If nobody rival is on the board none of this draws and
// the field is the whole motif.
//
// Colour is VALUE, not hue. This band is Neutral — mercenaries with a lute,
// not a faction with a magic — so the field has no colour of its own: it
// darkens the stone to near-black and lays parchment-cream crests on top of
// it. That is also the only way to get contrast on lit stone here; an additive
// glow the size of half the board is a white slab through ACES, and a warm
// glow on warm flagstones is invisible. Everything in this file is
// NormalBlending for that reason. The dark comes first, then the light.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=900" \
//             --eval tools/fxdemo/entrance.js --out /tmp/en-900.png \
//             --wait 8000 --settle 600
// ?t is milliseconds INTO the motif; see the harness, which also explains why
// the staging is cast from an edge square (from the centre the reach covers
// the whole board and there is no boundary to photograph).

import { THREE, CARD_W, CARD_H } from '../kit.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------- the clock */

// kit.hold hands the tick a FRACTION of the span, so the tick multiplies back
// up by SPAN and every number below is read in the seconds it was written in.
const SPAN = 2.9;
const STRIKE = 0.10;        // the band strikes up
const HUSH = 2.42;          // the motif starts handing the board back

/* -------------------------------------------------------------- the song */

// Wavelength and speed are chosen against the size of a SQUARE, not against
// anything physical. At 1.62 world units a wave is about 55 screen pixels, so
// a square carries a crest and a half and the train is legible; the 0.6 that
// was tried first sampled down to grey noise, which is the same wall song.js
// hit with its interference figure.
const LAMBDA = 1.62;
// 6.6, not 4.9. The reach is fixed by the rules at 7.15 world units, so the
// speed decides how long the board waits before the motif exists: at 4.9 the
// field took 1.46s of a 2.9s span to fill and a shot at 300ms was an ordinary
// board with a faint smudge on one square. At 6.6 the last square is reached
// inside a second and the whole second half is the field standing.
const SPEED = 6.6;                         // units/second — the leading front
const K = (Math.PI * 2) / LAMBDA;
const OMEGA = K * SPEED;                   // ~3 crests a second
// The bar. Every BEAT the band leans on it, and the stronger wavefront that
// leaves is what the victims sway to — so the rhythm you see on the stone and
// the rhythm the cards rock to are the same number. Without it the ripples are
// an even ripple-tank pattern and the field reads as a machine humming.
const BEAT = 0.62;

// The reach, in world MANHATTAN distance from the band. Square centres two
// away sit at 5.24 and three away at 7.86, so the edge is put between them and
// feathered: fully inside at 5.55, silent by 7.15.
const REACH_IN = 5.55;
const REACH_OUT = 7.15;

const GROUND_Y = 0.092;     // the flagstone face is 0.080
const FACE_UP = 0.055;      // what a flat thing needs to clear a card's face

// Near-black, slightly warm: a cold shadow on this board reads as moonlight.
const DIM = new THREE.Color(0x130e09);
// Parchment. Not white — white crests through the tone mapper are a lit strip
// light, and this is a lute.
const LIT = new THREE.Color(0xf6e6c2);
// The film over a victim. A NEUTRAL cool grey, and mid-dark rather than near
// black. Two earlier values were wrong in opposite directions: 0x222733 is
// more than twice as blue as it is red once it is in linear light, and over
// the warm cards — Horntusk Hunter, Wolfpack Soldier — it read as a different
// card in a different colourway rather than as the same card drained. And a
// film that is simply DARK only darkens, which is the trap the multiply on
// frontMat already falls into. Blending the card halfway to a grey of about
// its own value is what actually pulls the contrast and the saturation out of
// it: the picture is still there, it has just stopped mattering.
const FILM = new THREE.Color(0x3b3d44);

/** The positive half of the wave, sharpened: thin bright crests standing in
 *  broad dark troughs. A plain cosine spends half its life pale and the stone
 *  came out evenly milky. */
function crestAt(r, s) {
  const c = Math.cos(K * r - OMEGA * s);
  // Fourth power, not third. Cubed, the crest is wide enough that at sixty
  // pixels a card the wavefronts photographed as soft grey rings — smoke
  // drifting over the ruin. A narrow crest in a wide trough is what a ripple
  // tank looks like, and it is what separates this from fog.
  return c > 0 ? c * c * c * c : 0;
}

/** How hard the band was leaning when this crest left, which travels out with
 *  it — so the beat is visible as bands moving across the field rather than as
 *  the whole field pulsing on the spot. */
function beatAt(te) {
  const b = te / BEAT - Math.floor(te / BEAT);
  const g = 0.5 + 0.5 * Math.cos(Math.PI * 2 * b);
  return 0.30 + 0.70 * g * g;
}

/* ------------------------------------------------------------- the meshes */

/**
 * A disc of triangles to carry the wave, built by hand rather than with
 * RingGeometry so the vertex order is known: ring by ring, outward. The tick
 * computes the wave ONCE per ring — it depends only on radius — and the inner
 * loop over the spokes then only multiplies in that vertex's envelope.
 */
function disc(R, rings, spokes) {
  const n = (rings + 1) * spokes;
  const pos = new Float32Array(n * 3);
  const rr = new Float32Array(rings + 1);
  for (let j = 0; j <= rings; j++) {
    const r = (j / rings) * R;
    rr[j] = r;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const k = (j * spokes + i) * 3;
      pos[k] = Math.cos(a) * r;
      pos[k + 2] = Math.sin(a) * r;
    }
  }
  const idx = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < spokes; i++) {
      const i2 = (i + 1) % spokes;
      const a = j * spokes + i, b = j * spokes + i2;
      const c = (j + 1) * spokes + i, d = (j + 1) * spokes + i2;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.NormalBlending, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  return { mesh, rr, spokes, rings, col: geo.attributes.color };
}

/** A card-sized plate of the same wave, to lay over a victim's face. It is
 *  sampled per VERTEX, from the real distance to the band, so the crests
 *  crossing the card are continuous with the ones crossing the stone beside it
 *  — a card with its own private ripple pattern reads as a decal. */
function plate(w, h, seg) {
  const geo = new THREE.PlaneGeometry(w, h, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  const p = geo.attributes.position.array;
  // Feathered to nothing at the rim, so the card's own printed border stays
  // clear all the way round. Covered edge to edge the plate is a grey
  // rectangle exactly the size of a card, which is a card being deleted;
  // leaving the border is what says the fighter is still standing there.
  const fade = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.abs(p[i * 3]) / (w * 0.5), v = Math.abs(p[i * 3 + 2]) / (h * 0.5);
    fade[i] = sstep(1.0, 0.58, Math.max(u, v));
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.NormalBlending, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  // Sprites and decals on a card default to renderOrder 0 and would paint over
  // this; the card itself goes to 10 while it is being inspected, which is a
  // state nothing here has to survive.
  mesh.renderOrder = 7;
  return { mesh, fade, pos: p, col: geo.attributes.color, n };
}

/** A soft round bloom, for the band's own square and for the rivals'. Cached
 *  for the life of the page: kit.hold disposes materials and a material never
 *  disposes its map. */
let BLOOM = null;
function bloomTex() {
  if (BLOOM) return BLOOM;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.34, 'rgba(255,255,255,0.52)');
  grd.addColorStop(0.66, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  BLOOM = new THREE.CanvasTexture(c);
  BLOOM.colorSpace = THREE.SRGBColorSpace;
  return BLOOM;
}

function bloom(size, colour, order) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: bloomTex(), color: colour, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.NormalBlending,
    }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = order;
  return m;
}

/* -------------------------------------------------------------- the board */

/** The rules count distance along orthogonal adjacency, which on the nine
 *  squares is exactly Manhattan. Anything off the grid — the Void, a
 *  Stronghold — is not a square the band can reach and is left alone. */
const away = (a, b) => Math.abs((a / 3 | 0) - (b / 3 | 0)) + Math.abs((a % 3) - (b % 3));

/**
 * Who is in earshot. Defensive at every step: a flourish must never take the
 * table down with it, and this one runs on a CONSTANT ability, so it can be
 * asked to play with the board in any state at all.
 */
function earshot(kit, at) {
  const out = { here: null, mine: 0, dulled: [], rivals: [] };
  try {
    const self = kit.piece(at);
    out.here = self && self.square != null ? self.square
      : (typeof at === 'number' && at >= 0 && at <= 8 ? at : null);
    if (out.here == null || out.here > 8) return out;
    out.mine = self ? self.owner : (kit.pieces?.topAt?.(out.here)?.owner ?? 0);
    const map = kit.pieces && kit.pieces.byUid;
    if (!map) return out;
    for (const q of map.values()) {
      if (!q || q === self || q.isConstruct || q.depth) continue;
      if (q.square == null || q.square > 8) continue;
      if (q.owner === out.mine) continue;
      if (away(out.here, q.square) > 2) continue;
      (q.def && q.def.id === 'R092' ? out.rivals : out.dulled).push(q);
    }
  } catch { /* never throw */ }
  return out;
}

/** Take a card over. pieces.js only leaves a piece's transform and front
 *  material alone while `animating` is set — its update() returns early on the
 *  flag — so a motif that wants to hold a card still has to own it, and has to
 *  put everything back in `release` because pieces are pooled. */
function seize(piece) {
  if (!piece || piece.animating) return null;
  return {
    piece,
    home: piece.restingPosition?.() || piece.group.position.clone(),
    yaw: piece.baseYaw || 0,
    mat: piece.frontMat || null,
  };
}

function release(held) {
  for (const h of held) {
    if (h.mat) h.mat.color.setScalar(1);
    h.piece.group.position.copy(h.piece.restingPosition?.() || h.home);
    if (h.piece.tilt) h.piece.tilt.rotation.set(0, 0, 0);
    if (h.piece.card3d) h.piece.card3d.rotation.y = h.yaw;
    h.piece.animating = false;
  }
}

/* --------------------------------------------------------------- the cast */

export function entrance(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const band = earshot(kit, at);

  const g = new THREE.Group();

  /* --- the field. One disc carrying both halves of the picture: its vertex
     colour runs from near-black in the troughs to parchment on the crests, and
     its vertex alpha is the envelope. Normal-blended, so the dark actually
     darkens — an additive pass can only ever add light, and this motif is
     bought with shadow. */
  const RINGS = 72, SPOKES = 112;
  const field = disc(REACH_OUT, RINGS, SPOKES);
  field.mesh.position.set(p.x, GROUND_Y, p.z);
  // The diamond, per vertex, with a slow wobble on the edge so it is not a
  // ruled shape. A hard geometric boundary on this board is a UI overlay; the
  // wobble is small enough that the squares it takes in do not change.
  const env = new Float32Array((RINGS + 1) * SPOKES);
  {
    const pos = field.mesh.geometry.attributes.position.array;
    for (let k = 0; k < env.length; k++) {
      const x = pos[k * 3], z = pos[k * 3 + 2];
      const a = Math.atan2(z, x);
      const wob = 1 + 0.055 * Math.sin(a * 5 + 0.8) + 0.035 * Math.sin(a * 3 - 2.1);
      env[k] = sstep(REACH_OUT * wob, REACH_IN * wob, Math.abs(x) + Math.abs(z));
    }
  }
  g.add(field.mesh);

  /* --- the band's own square: a warm bloom on the stone that leans on every
     beat. Drawn WIDER than the card so it lands on stone rather than on the
     band's own art, which is the only clean contrast a card-sized mark has. */
  const source = bloom(CARD_W * 2.5, 0xffd9a2, 4);
  source.position.set(p.x, GROUND_Y + 0.006, p.z);
  g.add(source);

  /* --- the victims. Each gets a plate of the same wave over its face, and the
     card under it is darkened and taken over so it can sway. */
  const held = [];
  const victims = [];
  for (const q of band.dulled) {
    const h = seize(q);
    if (!h) continue;
    held.push(h);
    const pl = plate(CARD_W * 1.0, CARD_H * 1.0, 9);
    g.add(pl.mesh);
    victims.push({ h, pl, r: Math.abs(h.home.x - p.x) + Math.abs(h.home.z - p.z),
      d: Math.hypot(h.home.x - p.x, h.home.z - p.z) });
  }

  /* --- the rivals. No film, no drain: a pale bloom and a little wave system
     of their own, started on the first beat AFTER the sound reaches them. */
  const rivals = [];
  for (const q of band.rivals) {
    const h = seize(q);
    const home = h ? h.home : q.group.position.clone();
    const d = Math.hypot(home.x - p.x, home.z - p.z);
    if (h) held.push(h);
    const RR = 3.3;
    const echo = disc(RR, 22, 72);
    echo.mesh.position.set(home.x, GROUND_Y + 0.004, home.z);
    const eenv = new Float32Array(23 * 72);
    {
      const pos = echo.mesh.geometry.attributes.position.array;
      for (let k = 0; k < eenv.length; k++) {
        const r = Math.hypot(pos[k * 3], pos[k * 3 + 2]);
        eenv[k] = sstep(RR, RR - 1.1, r);
      }
    }
    g.add(echo.mesh);
    const glow = bloom(CARD_W * 2.1, 0xffe3b0, 4);
    glow.position.set(home.x, GROUND_Y + 0.008, home.z);
    g.add(glow);
    // the beat they come in on: the first bar line after they hear it
    const hears = STRIKE + d / SPEED;
    rivals.push({ h, echo, eenv, glow, home, d,
      join: Math.ceil(hears / BEAT) * BEAT + 0.02 });
  }

  // The strike-up itself. Short, warm, held clear of the card: a light at the
  // card's own height burns its art to a white patch, which is what the first
  // pass of this did to the band's faces.
  kit.light(p.clone().setY(p.y + 0.85), 0xffc271,
    { power: 13, seconds: 0.55, reach: 5.2 });

  kit.hold(g, SPAN, (k) => {
    const s = k * SPAN;
    // The motif fades; the music does not stop. Everything keeps rolling right
    // through the hand-back, because the ability is still true afterwards —
    // freezing the waves first would say the band had finished playing.
    const out = 1 - sstep(HUSH, SPAN, s);
    const beatWave = Math.sin((Math.PI * 2 * s) / BEAT);
    const lean = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (s / BEAT - Math.floor(s / BEAT)));

    /* ---- the field ---- */
    const FC = field.col.array;
    for (let j = 0; j <= RINGS; j++) {
      const r = field.rr[j];
      const reach = SPEED * (s - STRIKE) - r;
      if (reach <= -0.05) {
        for (let i = 0; i < SPOKES; i++) FC[(j * SPOKES + i) * 4 + 3] = 0;
        continue;
      }
      const arrived = clamp(reach / 0.62, 0, 1);
      // the leading edge is brighter as it passes — the first wavefront is the
      // one that tells you how far the music carries
      const flare = Math.exp(-((reach / 1.05) ** 2));
      // DISTANCE BUYS PRESENCE, NOT BRIGHTNESS. The first cut folded the 1/r
      // attenuation into the colour lerp, so a crest two squares out was 30 per
      // cent of the way from near-black to parchment — a dark brown band on
      // dark brown stone. Photographed at 0.9s the whole motif was one pale arc
      // and an evenly dimmed board: somebody turning the lights down, not a
      // band playing. The falloff now only takes the wash down, and a crest is
      // as pale where it still reaches as it is at the band's feet.
      // Flat-ish on purpose. A steep falloff put the whole of the motif in the
      // two squares nearest the band and let the diamond's edge arrive at
      // nothing; the reach is the subject, so the wash has to still be there
      // when it runs out.
      const att = 1 - 0.25 * sstep(0.8, REACH_IN, r);
      const m = clamp(crestAt(r, s) * beatAt(s - r / SPEED) * att * (1.15 + 1.1 * flare), 0, 1);
      // The dark is what makes this a FIELD rather than a set of rings. At 0.26
      // it photographed as nothing at all — the stone was its ordinary colour
      // and the motif was three pale arcs floating on it, so there was no
      // in-range and out-of-range to see. It falls away with `att`, which is
      // what stops it being a flat disc: the stone is deepest under the band
      // and the diamond's edge is where it runs out.
      const a0 = arrived * out * (0.42 * att + 0.50 * m);
      const v = Math.pow(m, 0.8);
      const cr = DIM.r + (LIT.r - DIM.r) * v;
      const cg = DIM.g + (LIT.g - DIM.g) * v;
      const cb = DIM.b + (LIT.b - DIM.b) * v;
      for (let i = 0; i < SPOKES; i++) {
        const o = (j * SPOKES + i) * 4;
        FC[o] = cr; FC[o + 1] = cg; FC[o + 2] = cb;
        FC[o + 3] = a0 * env[j * SPOKES + i];
      }
    }
    field.col.needsUpdate = true;

    // The strike itself. The band's own square had nothing but the beat on it
    // and the beat happened to be at its quietest at 300ms, so the opening of
    // the motif photographed as an untouched board: no attack, and a flourish
    // with no attack has not started. The flash is a separate term and it is
    // the loudest thing the square ever does.
    const strike = Math.exp(-(((s - STRIKE) / 0.11) ** 2));
    source.material.opacity = out * (0.16 + 0.22 * lean * lean + 0.46 * strike)
      * Math.min(1, s / 0.06);
    source.scale.setScalar(0.94 + 0.10 * lean + 0.22 * strike);

    /* ---- the victims ---- */
    for (const v of victims) {
      const { h, pl } = v;
      h.piece.animating = true;
      // it switches off when the sound REACHES it, not on a timer — so the
      // order the fighters go dull in draws the radius for you
      const vu = sstep(0, 0.42, s - STRIKE - v.d / SPEED) * out;

      // The sway. Amplitude measured in PIXELS, not in world units: a card is
      // 1.74 units and about 60 pixels wide, so 0.02 units is under a pixel
      // and the first cut of this was technically present and visually absent.
      // 0.10 is three or four, which at unison across half a dozen cards is
      // plainly a crowd moving together.
      const sway = beatWave * vu;
      const ox = sway * 0.10, oz = sway * 0.045;
      h.piece.group.position.set(h.home.x + ox, h.home.y - 0.012 * vu, h.home.z + oz);
      // leaning INTO the sway, so the card rocks like a metronome rather than
      // sliding about. Rotating about +z takes +x upward, hence the sign.
      if (h.piece.tilt) {
        h.piece.tilt.rotation.z = -sway * 0.085;
        h.piece.tilt.rotation.x = sway * 0.030;
      }
      if (h.mat) {
        // A multiply on frontMat CANNOT desaturate — it can only darken — so
        // this only takes a little off the top and the grey plate above does
        // the draining. At 0.40 the two together made a hole where the card
        // had been instead of a fighter standing there with nothing to give.
        const dead = 1 - 0.20 * vu;
        h.mat.color.setRGB(dead * 0.98, dead * 0.99, dead);
      }

      const P = pl.pos, CC = pl.col.array;
      pl.mesh.position.set(h.home.x + ox, Math.min(h.home.y, 0.225) + FACE_UP,
        h.home.z + oz);
      pl.mesh.rotation.z = -sway * 0.085;
      for (let i = 0; i < pl.n; i++) {
        const wx = h.home.x + ox + P[i * 3], wz = h.home.z + oz + P[i * 3 + 2];
        const r = Math.hypot(wx - p.x, wz - p.z);
        // The crest crossing a card is a SHEEN, not a second exposure of the
        // crest. Run at the same strength it has on the stone the plate went
        // the other way entirely: a wavefront over a victim lifted the whole
        // card to parchment, so the fighters in range photographed as the
        // cards with FOG over them and the dulling never arrived. It is
        // quartered here, and the film underneath it is what the card wears.
        const m = Math.min(1, crestAt(r, s) * beatAt(s - r / SPEED) * 0.34);
        const o = i * 4;
        CC[o] = FILM.r + (LIT.r - FILM.r) * m;
        CC[o + 1] = FILM.g + (LIT.g - FILM.g) * m;
        CC[o + 2] = FILM.b + (LIT.b - FILM.b) * m;
        CC[o + 3] = pl.fade[i] * vu * (0.54 + 0.22 * m);
      }
      pl.col.needsUpdate = true;
    }

    /* ---- the rivals ---- */
    for (const rv of rivals) {
      const on = sstep(rv.join, rv.join + 0.26, s) * out;
      // they nod along from the moment they hear it, and start PLAYING on the
      // next bar line — the gap between the two is the whole joke
      const nod = sstep(0, 0.4, s - STRIKE - rv.d / SPEED) * out;
      if (rv.h) {
        rv.h.piece.animating = true;
        const sway = beatWave * nod;
        rv.h.piece.group.position.set(rv.home.x + sway * 0.055, rv.home.y + 0.022 * nod * lean,
          rv.home.z + sway * 0.025);
        if (rv.h.piece.tilt) rv.h.piece.tilt.rotation.z = -sway * 0.05;
        // brightened rather than drained: inside a field that is taking the
        // colour out of everything else, staying lit IS the effect
        if (rv.h.mat) rv.h.mat.color.setScalar(1 + 0.16 * nod);
      }
      rv.glow.material.opacity = nod * (0.08 + 0.22 * lean * lean) * (0.5 + 0.5 * on);
      rv.glow.scale.setScalar(0.92 + 0.12 * lean);

      const EC = rv.echo.col.array;
      for (let j = 0; j <= rv.echo.rings; j++) {
        const r = rv.echo.rr[j];
        // Phase and beat are laid on the TOTAL distance from the first band,
        // so the rivals' ripples are a continuation of the ones arriving
        // rather than a second rhythm beating against them. That is what
        // "they play along" means, and it is the difference between a duet and
        // two bands busking on the same corner.
        const rt = rv.d + r;
        const m = Math.min(1, crestAt(rt, s) * beatAt(s - rt / SPEED)
          * (1 / (1 + 0.26 * rt)) * 2.2);
        const a0 = on * 0.52 * m;
        const cr = DIM.r + (LIT.r - DIM.r) * m;
        const cg = DIM.g + (LIT.g - DIM.g) * m;
        const cb = DIM.b + (LIT.b - DIM.b) * m;
        for (let i = 0; i < rv.echo.spokes; i++) {
          const o = (j * rv.echo.spokes + i) * 4;
          EC[o] = cr; EC[o + 1] = cg; EC[o + 2] = cb;
          EC[o + 3] = a0 * rv.eenv[j * rv.echo.spokes + i];
        }
      }
      rv.echo.col.needsUpdate = true;
    }
  }, () => release(held));
}
