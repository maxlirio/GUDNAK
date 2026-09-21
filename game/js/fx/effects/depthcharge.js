// A CHARGE going off under the water in your own Back Row.
//
// Shared by 1 card: M015 Wave Runner.
// One motif, one file — worked on on its own.
//
// THE PAUSE IS THE MOTIF. A drum is dropped, it sinks out of sight, and then
// for the better part of half a second NOTHING happens — and only after that
// silence does the water lift. Take the beat out and this is a generic
// explosion on a square; leave it in and the eye waits for it, which is the
// whole character of a depth charge. Everything else is built to protect that
// gap: the drum is out of sight early, and what fills the silence is only a
// train of ripples spreading from where it went in and dying away. The one
// tell that something is coming is a dim glow deep under the surface in the
// last fifth of a second.
//
// IT GOES UP. The faction already owns three water motifs and they all lie
// flat: ./cast-marvorren.js runs a sheet ACROSS one card, ./usher.js runs a
// lane FORWARD one square, ./tide.js runs a flood ALONG a row. Nothing on this
// table stands up. So this one is a COLUMN — the square goes under, and then a
// pillar of water taller than a card is wide stands over it. That silhouette
// is not available to any other effect, which is what makes it this card's.
//
// VALUE, NOT HUE, borrowed from the flourish because that file paid for it:
// Marvorren card art is itself blue-green, so a cool wash over it destroys
// every edge the artist drew. The water here is near-black, the only bright
// thing is foam, and the victim reads because the pool DARKENS him — he is
// under it — rather than because anything is painted over him in colour.
//
// The blast is MUFFLED. The bloom is under the surface, never whiter than the
// foam, and it spreads over a tenth of a second instead of popping.
//
// The victim goes WITH the water rather than dying a second time in the
// generic death: see timing and exit at the bottom of this file.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=1200" \
//             --eval tools/fxdemo/depthcharge.js --out /tmp/d.png \
//             --wait 4000 --settle 600
// ?t is milliseconds INTO the motif and ?me picks which legal square it fires
// on (see the harness); wall-clock --settle lands wherever the headless frame
// rate feels like on the day, and much past 600ms the table's own opening
// moves on and deals over the board.

import { THREE } from '../kit.js';
import { blobTexture } from '../../textures.js';

/* ------------------------------------------------------------------ time */

// Seconds, not fractions of the span. This motif is a SEQUENCE with eight
// moments in it and fractions are unreadable at that count; the tick converts
// once, at the top.
const SPAN = 2.35;
const OPEN = 0.10;                  // the square floods
const HIT = 0.22;                   // the drum touches the water
const GONE = 0.50;                  // the last of it is out of sight
const BLAST = 1.02;                 // and then, after the gap, this
const SWELL = 0.98;                 // the surface starts to dome just before
const RISE0 = 1.07, RISE1 = 1.52;   // the column goes up
const FALL1 = 2.08;                 // and comes down
const DRY0 = 1.95;                  // the pool drains off the stone

/* ----------------------------------------------------------------- shape */

// Radius of the pool. STEP/2 is 1.31, so 1.16 with a ragged rim keeps the
// water off the joints between flagstones: a disc that reaches the tile edges
// reads as the interface highlighting a square, which is the one thing a
// motif must never look like.
const RMAX = 1.16;
// NR is set by the RINGS, not by the disc: the travelling foam bands are a
// tenth of a unit across, and at the 16 rings this started with each one
// landed on two vertices and was interpolated into a soft grey smear — the
// blast came out as fog. 44 gives a band five rings to be an edge with.
const NA = 64, NR = 44;             // pool: angles, rings
const CA = 48, CH = 22;             // column: angles, levels
// Six times as tall as it is wide came out as a twisted RIBBON standing on
// the card. A charge lifts a square's worth of water, so the plume is about
// as wide at the foot as the card is and a little over twice that in height.
const COLR = 0.60;                  // column radius at the stem
const COLH = 2.6;                   // and its height at full stretch
const FALLH = 2.8;                  // how far above the board the drum starts

// Marvorren's own palette, pushed apart: one tint cannot carry both the depth
// of the water and the white of what breaks on top of it.
const MID = new THREE.Color(0x0d4a5e);
const PALE = new THREE.Color(0x5fb6cc);
const FOAM = new THREE.Color(0xc2ecf5);
// The blast light seen through water. Deliberately a rung below the foam:
// at the faction's own bright cyan the bloom tone-mapped to near white and
// the "muffled" reading went with it.
const GLOW = new THREE.Color(0x4fc4de);
// The flat water, mixed once. Near-black with just enough blue in it to read
// as sea rather than as a shadow on the flagstones; everything above it is
// put there by the shading.
const WATER = new THREE.Color(0x03141d).lerp(MID, 0.42);

// The sun is at (-13,15,9). The column is a vertical tube, so which side of it
// is lit is decided by the angle alone, and without that the pillar is a flat
// cutout with no volume at all.
const SUN = new THREE.Vector3(-13, 15, 9).normalize();

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const bump = (x, w) => Math.exp(-0.5 * (x / w) ** 2);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** A disc of quads, ring by ring, with room for per-vertex RGBA. */
function poolGeo() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * NA * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NR * NA * 4), 4));
  const idx = [];
  for (let i = 0; i < NR - 1; i++) {
    for (let a = 0; a < NA; a++) {
      const b = (a + 1) % NA;
      idx.push(i * NA + a, i * NA + b, (i + 1) * NA + a);
      idx.push(i * NA + b, (i + 1) * NA + b, (i + 1) * NA + a);
    }
  }
  geo.setIndex(idx);
  return geo;
}

/** A tube of quads, level by level. The same trick, standing up. */
function columnGeo() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CH * CA * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CH * CA * 4), 4));
  const idx = [];
  for (let i = 0; i < CH - 1; i++) {
    for (let a = 0; a < CA; a++) {
      const b = (a + 1) % CA;
      // Wound the other way round from the pool's: with the rings in the
      // obvious order the tube's front faces point INWARD, so culling the
      // back threw away the outside of the column and kept the far inner
      // wall — the plume simply did not draw.
      idx.push(i * CA + b, i * CA + a, (i + 1) * CA + a);
      idx.push((i + 1) * CA + b, i * CA + b, (i + 1) * CA + a);
    }
  }
  geo.setIndex(idx);
  return geo;
}

let BLOB = null;
const blob = () => (BLOB || (BLOB = blobTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)')));

/**
 * The radius of the plume at height u: a flared foot and a stem.
 *
 * A cone, with NO widening at the top. The head was tried
 * as a bulge in the mesh — a cauliflower of water on the stem — and a wide
 * translucent dome of pale grey standing over warm stone is SMOKE, every
 * time. The crown is left to the spray instead, which is what the top of a
 * plume is made of anyway.
 */
const stem = (u) => COLR * (0.62 + 0.70 * Math.exp(-u / 0.20) + 0.10 * u * u);

export function depthcharge(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  // Flat work sits 0.055 clear of whatever it lies on. At 0.03 — where every
  // one of these files started — a decal lands ON the card's face to within a
  // rounding error, loses the depth test (gl.LESS fails on equal) and draws on
  // the stone AROUND the card but not on the card itself.
  const TOP = Math.min(p.y, 0.225) + 0.055;

  const g = new THREE.Group();
  g.position.set(p.x, TOP, p.z);

  /* ----------------------------------------------------------- the water */

  // Unlit on purpose. The key light is a warm low sun and a teal surface lit
  // by it goes grey-green; every colour here is placed by hand in the vertex
  // attribute, and the form is carried by shading done the same way.
  const pool = new THREE.Mesh(poolGeo(), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  pool.renderOrder = 2;
  pool.frustumCulled = false;
  g.add(pool);

  // FrontSide, and that is not a saving. Double-sided, the camera looks down
  // the open top of the tube and sees the dark far wall from inside: a black
  // disc ringed with white, which read as a hole in the board with a rock
  // sitting in it. Culling the back leaves the near wall only, which is what a
  // column of water actually presents.
  const column = new THREE.Mesh(columnGeo(), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.FrontSide,
  }));
  column.renderOrder = 4;
  column.frustumCulled = false;
  column.visible = false;
  g.add(column);

  /* ------------------------------------------------------------ the drum */

  // A real object, lit, because for a fifth of a second it is ABOVE the water
  // and has to read as iron falling rather than as one more glow. It is the
  // only lit thing in the motif.
  // Not as dark as iron really is. At 0x1d262c the drum was a hole punched in
  // the card: the braziers are low and warm and there is no environment map,
  // so a near-black metal gets no highlight at all and reads as absence. A
  // couple of stops up it still reads as iron against warm stone.
  const iron = new THREE.MeshStandardMaterial({
    color: 0x2e3a43, roughness: 0.5, metalness: 0.55, transparent: true,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0x8a7047, roughness: 0.45, metalness: 0.7, transparent: true,
  });
  const drum = new THREE.Group();
  // BIGGER than a real one would be beside a card this size. At 0.15 by 0.30
  // the drop — the beat the whole motif is named for — was ten screen pixels
  // at the table's own field of view: a dark speck falling, which nobody can
  // call a drum. A fifth of the card's width is still plainly an object
  // rather than a lid over the square, and it can be read.
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.42, 14), iron);
  shell.castShadow = true;
  drum.add(shell);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.228, 0.228, 0.085, 14), brass);
  drum.add(band);
  drum.rotation.z = 0.5;
  drum.renderOrder = 1;       // under the pool sheet, so the water covers it
  g.add(drum);

  /* --------------------------------------------------------- the bubbles */

  // Bubbles coming up behind the drum. They are a DETAIL and not the tell:
  // at this size a pale soft blob lying on water is indistinguishable from a
  // caustic, and the first pass leant on them to carry the whole pause and
  // carried nothing. The ripples in the pool do that job; these just give the
  // eye something small to find while it waits.
  const bubbles = new THREE.Group();
  const bub = [];
  for (let i = 0; i < 15; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blob(), color: 0xf4fdff, transparent: true, depthWrite: false, opacity: 0,
    }));
    const size = 0.09 + Math.random() * 0.07;
    s.scale.setScalar(size);
    // Per SPRITE. renderOrder on a Group does not reach its children in
    // three.js, so every bubble and every fleck of spray was still sorting at
    // 0 — under the pool sheet — and the dark water was drawn over the top of
    // them. For one missing line the burst had no spray in it at all.
    s.renderOrder = 3;
    bubbles.add(s);
    const u = i / 14;
    bub.push({
      // Spread over the whole gap and thinning as it goes, so the silence
      // gets quieter rather than simply lasting.
      born: HIT + 0.06 + u * u * (BLAST - HIT - 0.14),
      life: 0.34 + Math.random() * 0.3,
      r: (0.04 + Math.random() * 0.30) * (1 - u * 0.5),
      a: Math.random() * Math.PI * 2,
      alpha: 0.75 - u * 0.3, size,
    });
  }
  g.add(bubbles);

  /* ----------------------------------------------------------- the spray */

  // Flying water, so sprites are right here — a camera-facing blob is only a
  // bokeh dot when it sits STILL on a surface. Small and many, never few and
  // bright.
  const spray = new THREE.Group();
  const flecks = [];
  for (let i = 0; i < 52; i++) {
    const crown = i >= 18;                 // most of it is thrown off the top
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blob(), color: 0xdcf4fb, transparent: true, depthWrite: false, opacity: 0,
    }));
    s.renderOrder = 6;          // over the column, see the note on bubbles
    spray.add(s);
    const a = Math.random() * Math.PI * 2;
    const out = crown ? 0.5 + Math.random() * 1.5 : 1.1 + Math.random() * 1.9;
    flecks.push({
      born: crown ? RISE0 + Math.random() * 0.42 : BLAST + 0.04 + Math.random() * 0.1,
      life: 0.5 + Math.random() * 0.55,
      vx: Math.cos(a) * out, vz: Math.sin(a) * out,
      vy: crown ? 1.4 + Math.random() * 2.6 : 0.8 + Math.random() * 1.2,
      y0: crown ? 0.9 + Math.random() * 0.9 : 0.06,
      r0: crown ? Math.random() * 0.3 : 0.18 + Math.random() * 0.3,
      a,
      // Mostly SMALL. Drawn from a flat range they all came out about the
      // same size, and two dozen evenly bright discs of the same size over a
      // teal mound are polka dots, not water. Squaring the draw gives a few
      // fat gobs and a lot of droplets, and the fat ones are the dimmer.
      size: 0.05 + Math.random() ** 2 * (crown ? 0.19 : 0.12),
      alpha: 0.4 + Math.random() * 0.5,
    });
  }
  g.add(spray);

  /* ------------------------------------------------------- the two grids */

  const pPos = pool.geometry.attributes.position.array;
  const pCol = pool.geometry.attributes.color.array;
  const cPos = column.geometry.attributes.position.array;
  const cCol = column.geometry.attributes.color.array;

  // Per-angle constants: the ragged rim of the pool, and the flutes and torn
  // top of the column. A smooth disc is a decal and a smooth tube is a pipe.
  // Every angular frequency below is written in the ANGLE and not in the
  // vertex index. Indexed, a modest-looking coefficient becomes a multiple of
  // the 64 columns — a*2.3 is twenty-three cycles round the square — and
  // every band, ring and caustic came out as a clean starburst of twenty-odd
  // even spokes. In radians the number in the source is the number of lobes.
  const COS = new Float32Array(NA), SIN = new Float32Array(NA);
  const TH = new Float32Array(NA), RIM = new Float32Array(NA), WOB = new Float32Array(NA);
  for (let a = 0; a < NA; a++) {
    const th = (a / NA) * Math.PI * 2;
    TH[a] = th;
    COS[a] = Math.cos(th); SIN[a] = Math.sin(th);
    RIM[a] = 1 + 0.06 * Math.sin(th * 3 + 0.8) + 0.035 * Math.sin(th * 7 + 2.1);
    // The travelling rings are not circles. A perfect one modulated only in
    // brightness scallops into a cog; a front that is further out in some
    // directions than others is a front.
    WOB[a] = 1 + 0.13 * Math.sin(th * 2 + 0.6) + 0.08 * Math.sin(th * 5 - 1.4);
  }
  const CC = new Float32Array(CA), CS = new Float32Array(CA), CTH = new Float32Array(CA);
  const FLUTE = new Float32Array(CA), TORN = new Float32Array(CA), LIT = new Float32Array(CA);
  for (let a = 0; a < CA; a++) {
    const th = (a / CA) * Math.PI * 2;
    CTH[a] = th;
    CC[a] = Math.cos(th); CS[a] = Math.sin(th);
    FLUTE[a] = 1 + 0.16 * Math.sin(th * 3 + 1.3) + 0.09 * Math.sin(th * 7 - 0.4);
    // The torn top, kept modest. At twice this spread two angles stood a
    // third higher than the rest and the plume grew ANTLERS.
    TORN[a] = 0.87 + 0.11 * Math.sin(th * 5 + 0.6) + 0.07 * Math.sin(th * 2 - 1.9);
    LIT[a] = Math.max(0, CC[a] * SUN.x + CS[a] * SUN.z);
  }

  const piece = kit.piece(at);
  const c = new THREE.Color();

  // The blast light, on its own clock. Short and small: at reach 6 it lit the
  // neighbouring squares and the whole board went cold for a beat, which made
  // the motif everyone's rather than this square's.
  kit.after(BLAST, () => {
    kit.light(new THREE.Vector3(p.x, TOP + 0.3, p.z), 0x6fd6e8,
      { power: 8, seconds: 0.55, reach: 4.2 });
  });

  kit.hold(g, SPAN, (t) => {
    const s = t * SPAN;
    const det = s - BLAST;                       // time since the detonation
    const open = smooth(s / OPEN);
    const dry = 1 - smooth((s - DRY0) / (SPAN - DRY0));

    /* ---------------------------------------------------------- the drum */

    if (s < HIT) {
      const u = s / HIT;
      drum.visible = true;
      // Accelerating, and it arrives at full speed rather than easing into
      // the water: y = h(1-u^2) has its fastest frame the one before impact.
      drum.position.set(0.02, FALLH * (1 - u * u) + 0.06, -0.02);
      drum.rotation.set(0.18, 0, 0.5 + u * 0.55);
      drum.scale.setScalar(1);
      iron.opacity = brass.opacity = 1;
    } else if (s < GONE) {
      // Under. It cannot go DOWN in the world — the card's own face is right
      // there and would occlude it after two centimetres — so the sink is
      // carried by perspective instead: it shrinks away and the dark water
      // drawn over it takes the light off it.
      const u = (s - HIT) / (GONE - HIT);
      // Front-loaded: most of it happens in the first fifth of a second. A
      // drum that shrinks evenly over four tenths sits ON the water like a
      // barrel floating there, and the pause cannot start until it is gone.
      const k = smooth(u) ** 0.65;
      drum.position.y = 0.005;
      drum.scale.setScalar(1 - 0.78 * k);
      // It rolls back toward UPRIGHT as it goes under, and that is a drawing
      // decision and not a physical one. The camera's elevation is fixed, so
      // a cylinder lying on its side is a rectangle from up here — at the
      // 2.0 radians this used to reach, the beat where the drum touches the
      // water was a hard-edged black slab with a brass stripe across it
      // sitting on the fighter's chest. Nearly upright it is a disc inside a
      // brass hoop, which is what a drum dropped into water looks like from
      // above, and it shrinks away as a round thing rather than a plank.
      drum.rotation.set(0.18 + k * 0.28, 0, 1.05 - k * 0.6);
      iron.opacity = brass.opacity = (1 - k) ** 1.3;
    } else {
      drum.visible = false;
    }

    /* ---------------------------------------------------------- the pool */

    // The swell before the blast and the flare after it. The surface starts
    // to dome a few frames EARLY — water is pushed ahead of the light — and
    // that little tell is what stops the detonation reading as a cut.
    const domeE = smooth((s - SWELL) / 0.14) * (1 - smooth((s - RISE0 - 0.05) / 0.3));
    const shockR = det > 0 ? det * 3.2 : -1;
    const shockE = det > 0 ? (1 - smooth(det / 0.38)) : 0;
    const surgeR = det > 0.1 ? 0.25 + (det - 0.1) * 1.5 : -1;
    const surgeE = det > 0.1 ? smooth((det - 0.1) / 0.1) * (1 - smooth((det - 0.3) / 0.4)) : 0;
    // The tell: a dim glow a long way down, in the last fifth of a second of
    // the gap. It is the only warning, and at the 0.16 over a tenth of a unit
    // it started at it was invisible — the blast arrived out of nothing.
    const tell = det < 0 ? 0.3 * smooth((s - (BLAST - 0.2)) / 0.2) : 0;
    // The bloom: the light of the thing going off, seen THROUGH water. It
    // grows, it is soft-edged, and it is capped below the foam's brightness —
    // muffled is the whole point, and a hard white pop on top of the surface
    // read as a fireball sitting on a card with no water in it at all.
    const bloomE = det < 0 ? tell
      : 0.42 * smooth(det / 0.06) * (1 - smooth((det - 0.09) / 0.3));
    const bloomR = det < 0 ? 0.3 : 0.24 + clamp01(det / 0.3) * 0.34;
    // Foam left lying on the water after the column has come down.
    const wash = smooth((s - RISE1) / 0.3) * dry;
    // RIPPLES, a train of them, and they are what the silent beat is made
    // of. One splash ring that died in a quarter of a second left the gap
    // with nothing in it at all: bubbles were tried first and at this size a
    // pale soft blob on water is indistinguishable from a caustic. Rings
    // read, because they MOVE — three of them leaving the entry point a fifth
    // of a second apart and still spreading when the charge is long gone is
    // the picture of water that has been disturbed and is settling.
    const RIPR = [0, 0, 0], RIPW = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const e = s - HIT - k * 0.21;
      if (e <= 0 || det > 0) continue;
      RIPR[k] = 0.09 + e * 0.92;
      // Steeply weighted. Held near full, three even white rings on a dark
      // square are a target drawn on the fighter; the entry ring is the only
      // one meant to be read, and the two behind it are barely there.
      RIPW[k] = (k === 0 ? 1 : k === 1 ? 0.42 : 0.18) * Math.max(0, 1 - e / 0.92) ** 1.3;
    }

    /** The standing height of the water at radius r, this frame. */
    const lift = (r) => 0.40 * bump(r, 0.52) * domeE
      + (shockE > 0 ? 0.05 * bump(r - shockR, 0.10) * shockE : 0)
      + (surgeE > 0 ? 0.10 * bump(r - surgeR, 0.16) * surgeE : 0)
      + (RIPW[0] > 0 ? 0.018 * bump(r - RIPR[0], 0.05) * RIPW[0] : 0);

    for (let i = 0; i < NR; i++) {
      const rr = (i / (NR - 1)) ** 0.85;          // rings bunched at the rim
      const r0 = rr * RMAX;
      // The height of the water is a function of the RADIUS alone, so it and
      // its slope are sampled once a ring rather than once a vertex.
      const h0 = lift(r0);
      // Slope shading, and it is doing nearly all the work. The first pass
      // brightened the water by its HEIGHT, which turns the swell into one
      // flat mid-teal disc the size of the card — a pale coin lying on the
      // fighter with no form in it at all. Shading by the slope instead gives
      // the mound a lit flank and a dark one, which is the only thing that
      // makes it read as water standing up.
      const dh = (lift(r0 + 0.05) - lift(r0 - 0.05)) * 10;
      const nl = 1 / Math.sqrt(1 + dh * dh);
      for (let a = 0; a < NA; a++) {
        const r = r0 * RIM[a];
        const th = TH[a], wob = WOB[a];
        const n = (i * NA + a) * 3, n4 = (i * NA + a) * 4;

        // Where this vertex actually IS. The texture of the water is built
        // on x and z from here down and not on the angle: ANY pattern made of
        // th and r converges at the middle of the square, and the foam came
        // out as a pinwheel of crescents turning about the centre of the card
        // with a starburst in the eye of it. Crossed sines in the plane have
        // no centre to converge on.
        const px = COS[a] * r, pz = SIN[a] * r;
        const chop = 0.012 * Math.sin(r * 7.3 + th * 4 + s * 2.4);
        pPos[n] = px; pPos[n + 1] = (h0 + chop) * open; pPos[n + 2] = pz;

        // The sun, against the surface. dh is the fall of the water along the
        // radius, so the horizontal part of the normal lies along it.
        const lit = (SUN.y - dh * (COS[a] * SUN.x + SIN[a] * SUN.z)) * nl;
        const shade = 0.3 + 0.8 * Math.max(0, lit);
        c.copy(WATER).multiplyScalar(shade);
        // Caustics: two travelling waves crossed, which is the one cue that
        // survives at card size from almost overhead. Switched off by the
        // blast — they are a calm-water cue and the water is not calm now.
        //
        // The sixth power this started with isolated every cell of that
        // lattice into one round dot, and the mesh only has the resolution
        // for about twenty of them: on a 60-pixel card that is twenty evenly
        // bright teal spots in a grid, which reads as GLITTER sprinkled over
        // the fighter and not as light on water. It was also what was being
        // mistaken for a spiral — the dots sit on the pool's own rings, so
        // the eye joins them up into arcs. Squared instead, the cells are
        // soft patches that run into one another, and a third slow wave puts
        // most of them out entirely: mottling with a few brighter passages
        // in it rather than a regular array of lamps.
        const net = Math.sin(px * 13 + pz * 5.4 + s * 3.1)
          * Math.sin(pz * 11 - px * 6.2 - s * 2.2);
        const patch = 0.22 + 0.78 * Math.sin(px * 2.3 - pz * 3.1 + s * 0.9) ** 2;
        c.lerp(PALE, Math.max(0, net) ** 2.2 * 0.17 * patch * (1 - clamp01(det / 0.2)));
        // The bloom, from underneath.
        const glow = bump(r, bloomR * 0.62) * bloomE;
        c.lerp(GLOW, clamp01(glow * 0.85));
        // White water, and nowhere else: the ripples off the entry, the shock
        // front, and the base surge racing out after it. Each one is a NARROW
        // band — a wide one is a pale wash over the card and the whole motif
        // goes to fog.
        let splash = 0;
        for (let k = 0; k < 3; k++) {
          if (RIPW[k] > 0) splash += bump(r - RIPR[k] * wob, 0.036) * RIPW[k];
        }
        const ring = shockE > 0 ? bump(r - shockR * wob, 0.05) * shockE : 0;
        // The surge band, broken up along its length so it is foam and not
        // tape. In the plane, again: modulated by the angle it scalloped into
        // a cog lying on the square.
        const torn = 0.5 + 0.5 * Math.sin(px * 5.1 + pz * 4.3 + 1);
        const foam = (surgeE > 0 ? bump(r - surgeR * wob, 0.055) * surgeE : 0) * (0.5 + 0.6 * torn);
        // Foam left lying on the water once the column has come down, in
        // blotches rather than in one sheet.
        const blotch = Math.max(0, Math.sin(px * 7.7 + pz * 3.1)
          * Math.sin(pz * 6.3 - px * 2.7 + 1.9) - 0.15);
        // The surge is held DOWN hard. At full weight it is a white O round
        // the square — and the board already opens a ring for a landing, a
        // clash and a death, so a bright ring is the one shape that says
        // "something generic happened here".
        const white = clamp01(splash * 0.34 + ring * 0.7 + foam * 0.5
          + wash * 0.4 * blotch * bump(r - 0.5, 0.45));
        c.lerp(FOAM, white);

        pCol[n4] = c.r; pCol[n4 + 1] = c.g; pCol[n4 + 2] = c.b;
        // The rim fades out rather than ending on a line; the pool is a hole
        // in the board, not a coin lying on it.
        const edge = 1 - smooth((rr - 0.80) / 0.20);
        pCol[n4 + 3] = clamp01(open * dry * (edge * 0.72 + white * 0.5 + glow * 0.28));
      }
    }
    pool.geometry.attributes.position.needsUpdate = true;
    pool.geometry.attributes.color.needsUpdate = true;

    /* -------------------------------------------------------- the column */

    // BALLISTIC, not eased. The water leaves the surface at speed and is
    // slowed by gravity, so x(2-x): fast off the mark, dead stop at the top.
    // Smoothstep put the plume through a stage of being SHORT AND FAT, and a
    // short fat tube seen from this camera is a disc of vertical streaks —
    // the square wore a white pinwheel for a fifth of a second.
    const x = clamp01((s - RISE0) / (RISE1 - RISE0));
    const rise = x * (2 - x);
    const fall = smooth((s - RISE1) / (FALL1 - RISE1));
    // It SUBSIDES. At a gentler exponent the plume held most of its height
    // to the end and then stopped being drawn, which left a teal dome sitting
    // on the square like a jellyfish.
    const H = COLH * rise * (1 - fall) ** 1.25;
    column.visible = H > 0.02;
    if (column.visible) {
      const spread = 1 + fall * 0.5;              // it slumps as it comes down
      const body = Math.min(1, rise * 4) * (1 - fall) ** 0.8;
      for (let i = 0; i < CH; i++) {
        const u = i / (CH - 1);
        const rad = stem(u) * spread;
        // Value up the column, and it stays WATER-coloured most of the way:
        // white from halfway made the plume a grey column standing against
        // warm stone, which is smoke. The white belongs at the torn top.
        c.copy(MID).lerp(PALE, smooth(u / 0.45));
        c.lerp(FOAM, smooth((u - 0.62) / 0.42) ** 0.9);
        // Coming down it is not clear water any more, it is FROTH: whiter and
        // more opaque. Left as it was, the collapsing mound was transparent
        // enough that the speckles of the flagstone read straight through it
        // and the whole thing looked like a bag rather than a mass of water.
        c.lerp(FOAM, fall * 0.45);
        // The feather is the top quarter and no more. It used to start at
        // u = 0.45 and run to the crown, which faded out exactly the part of
        // the column the colour ramp had made white — the plume was a grey
        // stump with its best half invisible.
        const feather = (1 - smooth((u - 0.74) / 0.3)) * smooth((u - 0.02) / 0.1);
        for (let a = 0; a < CA; a++) {
          const n = (i * CA + a) * 3, n4 = (i * CA + a) * 4;
          // The flutes breathe, so the silhouette is never the same two
          // frames running. Fixed, the cone had the stillness of a tent.
          const rr = rad * (FLUTE[a] + 0.08 * Math.sin(CTH[a] * 4 + s * 3.4));
          cPos[n] = CC[a] * rr;
          cPos[n + 1] = u * H * TORN[a];
          cPos[n + 2] = CS[a] * rr;
          // The lit flank. A tube with one colour all the way round is a
          // cardboard cutout at this camera.
          const shade = 0.46 + 0.8 * LIT[a];
          // Streaks: water goes up in ropes, not as a skin. Two frequencies
          // that do not divide into each other, or it comes out as a fence.
          const streak = 0.55 + 0.3 * Math.sin(CTH[a] * 9 + u * 9 - s * 5)
            + 0.22 * Math.sin(CTH[a] * 5 - u * 14);
          cCol[n4] = c.r * shade; cCol[n4 + 1] = c.g * shade; cCol[n4 + 2] = c.b * shade;
          // Dense. At 0.2 minimum the streaks left the plume as three thin
          // ghostly tendrils — steam off a cup, not a ton of water going up.
          cCol[n4 + 3] = clamp01(body * feather * (0.5 + 0.5 * clamp01(streak))
            * (0.92 + 0.5 * fall));
        }
      }
      column.geometry.attributes.position.needsUpdate = true;
      column.geometry.attributes.color.needsUpdate = true;
    }

    /* ------------------------------------------------- bubbles and spray */

    for (let i = 0; i < bub.length; i++) {
      const b = bub[i];
      const e = (s - b.born) / b.life;
      const sp = bubbles.children[i];
      if (e <= 0 || e >= 1 || s > BLAST) { sp.material.opacity = 0; continue; }
      // They POP rather than drift: a bubble reaching the surface from below
      // is a small thing that appears, swells and is gone, and the swell is
      // the only part of it the eye catches at this size.
      const wob = Math.sin(e * 7 + i) * 0.03;
      sp.position.set(Math.cos(b.a) * b.r + wob, 0.012 + e * 0.05, Math.sin(b.a) * b.r);
      sp.scale.setScalar(b.size * (0.6 + 0.7 * e));
      sp.material.opacity = b.alpha * Math.min(1, e * 6) * (1 - e) ** 1.4;
    }

    for (let i = 0; i < flecks.length; i++) {
      const f = flecks[i];
      const e = s - f.born;
      const sp = spray.children[i];
      if (e <= 0 || e >= f.life) { sp.material.opacity = 0; continue; }
      const y = f.y0 + f.vy * e - 3.4 * e * e;
      if (y < 0) { sp.material.opacity = 0; continue; }
      sp.position.set(Math.cos(f.a) * f.r0 + f.vx * e, y, Math.sin(f.a) * f.r0 + f.vz * e);
      sp.scale.setScalar(f.size * (1 + e * 0.5));
      sp.material.opacity = f.alpha * (0.55 + 0.45 * (1 - f.size / 0.24))
        * Math.min(1, e * 12) * (1 - e / f.life) ** 1.2;
    }

    /* ---------------------------------------------------------- the card */

    // The water starts to lift him. This is only a FALLBACK: in a real game
    // exit.destroy below takes the card over a frame or two later and owns it
    // the rest of the way, and `animating` is how it says so. It survives for
    // the effect browser, where nothing is ever destroyed and a card sitting
    // dead still under an erupting column looks bolted to the board.
    //
    // Height ONLY, and no rotation: the exit rotates piece.tilt, and a leftover
    // tilt written here onto piece.group would have ridden the whole throw and
    // then snapped straight when this motif's own hold ended.
    if (piece && !piece.animating && piece.restingPosition && det > 0) {
      const k = det < 0.09 ? smooth(det / 0.09)
        : Math.max(0, 1 - (det - 0.09) / 0.62) ** 1.3;
      piece.group.position.y = piece.restingPosition().y + 0.36 * k;
    }
  }, () => {
    iron.dispose(); brass.dispose();
  });
}

/* ------------------------------------------------- what becomes of the card */

/**
 * How long the victim must stay on the table after the rules have killed him.
 *
 * This is the one motif where the number is not a matter of taste: the whole
 * character of it is the SILENT BEAT between the drop and the blast, and a
 * pause held over an empty square is not a pause at all — it is a gap. So the
 * card has to survive the drop, the sink and the whole of the gap, and be
 * standing there under the water at the instant the charge goes off. That
 * instant is BLAST, and the exit below picks him up on the same frame.
 */
export const timing = { kill: BLAST };

export const exit = {
  /**
   * The generic death strikes a card flat, puts a red burst and a red ring
   * under it and slides it onto the pile. A fighter a depth charge has just
   * blown out of the water dying in that motion reads as two unrelated things
   * happening to one card, and the second of them knows nothing about water.
   *
   * What happens to him instead is what happens to anything standing over a
   * charge: he is THROWN. Straight up on the column, turning over, shedding
   * the water he came up with, and down onto the discard pile on the other
   * side of the board. He does not fade out where he stood — a card that
   * dissolves in place reads as deleted rather than killed, and the eye loses
   * where it went.
   */
  destroy(kit, piece, square, ev, done) {
    const at = piece.group.position.clone();
    const pile = kit.grave(piece.owner);
    // He is already a little off the board when this takes over — the motif
    // has begun to lift him — so the arc is launched from where he IS and
    // drifted back down to the height a card lies at, or he would come to
    // rest hovering exactly that far above the pile.
    const restY = piece.restingPosition ? piece.restingPosition().y : at.y;
    piece.animating = true;

    // He does not move at all for the first sixth of a second — he is UNDER
    // the water and the water is drawn over him. That wait is not politeness,
    // it is the only way the blast can be seen: a card lies flat and is as
    // wide as the square, so the moment it lifts even a little it covers the
    // bloom and the foot of the column from this camera, and the first pass
    // threw him on the frame of the detonation and hid the detonation behind
    // him. By the time he goes the column is already up around him.
    const HELD = 0.16;
    const SPAN = 1.62, LAND = 1.16;   // LAND is measured from HELD
    // Launched, not lerped. V0 and G are chosen so the arc comes down exactly
    // on the pile at LAND: an eased slide with a sine hump over it reads as a
    // card being MOVED by the interface, and the one thing this has to look
    // like is a thing thrown by something else.
    const V0 = 7.0, G = (2 * V0) / LAND;

    // The water he brings up with him. It leaves the card WHERE THE CARD IS
    // at the moment it comes off, which is why each drop's origin is taken in
    // the tick rather than up here — droplets born at the square would trail
    // from a place he had already left.
    const drops = new THREE.Group();
    const dd = [];
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: blob(), color: 0xcfeef8, transparent: true, depthWrite: false, opacity: 0,
      }));
      sp.scale.setScalar(0.08 + Math.random() * 0.09);
      sp.renderOrder = 6;
      drops.add(sp);
      const a = Math.random() * Math.PI * 2, out = 0.3 + Math.random() * 1.1;
      dd.push({
        born: HELD + Math.random() ** 1.5 * 0.5, t0: -1, p: new THREE.Vector3(),
        vx: Math.cos(a) * out, vz: Math.sin(a) * out, vy: 0.2 + Math.random() * 1.2,
        life: 0.45 + Math.random() * 0.4, alpha: 0.5 + Math.random() * 0.4,
      });
    }

    const mats = [piece.frontMat, piece.backMat, piece.card3d.material[0]];
    const base = mats.map((m) => m.color.clone());
    for (const m of mats) m.transparent = true;

    kit.hold(drops, SPAN, (t) => {
      const s = t * SPAN;
      if (s < HELD) return;                    // still under the water
      const fly = Math.min(s - HELD, LAND);
      const spin = fly / LAND;

      // Up first, across second: the horizontal run does not start until he
      // is clear of the water. Started at zero it looked like he had been
      // swatted sideways off the square.
      const h = clamp01((fly - 0.08) / (LAND - 0.08));
      piece.group.position.set(
        at.x + (pile.x - at.x) * h,
        at.y + V0 * fly - 0.5 * G * fly * fly + (restY - at.y) * spin,
        at.z + (pile.z - at.z) * h,
      );
      // A whole turn, ending flat: he lands ON the pile rather than at some
      // angle through it. The wobble is on the tilt and not on the card mesh
      // because the yaw lives underneath — spun there, a card turned face-on
      // to the other player halfway through the throw.
      piece.tilt.rotation.x = -Math.PI * 2 * smooth(spin);
      piece.tilt.rotation.z = Math.sin(spin * 7.5) * 0.45 * (1 - spin);
      piece.group.scale.setScalar(1 - 0.16 * spin);

      // Soaked: nearly black coming out of the water, drying toward the pile.
      const wet = 0.4 + 0.5 * clamp01((fly - 0.08) / 0.75);
      for (let i = 0; i < mats.length; i++) mats[i].color.copy(base[i]).multiplyScalar(wet);
      // He only fades once he is DOWN, and only part of the way: it is the
      // last card on a pile of cards settling in, not a card evaporating.
      const settle = clamp01((s - HELD - LAND) / (SPAN - HELD - LAND));
      for (const m of mats) m.opacity = 1 - 0.7 * settle;

      for (let i = 0; i < dd.length; i++) {
        const d = dd[i], sp = drops.children[i];
        if (s < d.born) { sp.material.opacity = 0; continue; }
        if (d.t0 < 0) { d.t0 = s; d.p.copy(piece.group.position); }
        const e = s - d.t0;
        if (e >= d.life) { sp.material.opacity = 0; continue; }
        sp.position.set(d.p.x + d.vx * e, d.p.y + d.vy * e - 4.5 * e * e, d.p.z + d.vz * e);
        sp.material.opacity = d.alpha * Math.min(1, e * 14) * (1 - e / d.life) ** 1.3;
      }
    }, () => {
      // Pieces are POOLED. A card handed back still dark and half transparent
      // comes out of the pool next turn as a ghost of itself.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i]);
        mats[i].opacity = 1;
      }
      piece.tilt.rotation.set(0, 0, 0);
      piece.group.scale.setScalar(1);
      piece.animating = false;
      done?.();
    });
  },
};
