// THE MARVORREN FLOURISH — the sea — a wave washing across the card.
//
// What a Marvorren card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// The shape has to be a CROSSING. The board already opens a ring for a card
// landing, for a clash and for a death, so one more expanding ring says
// "something generic happened" — the exact opposite of the job. So this one
// TRAVELS: water rises out of the stone at one corner of the square, runs
// diagonally over the card and drains away at the far corner. It is the only
// motif on the table that goes ACROSS rather than out, down or up, and the
// diagonal keeps it off the square's own edges so it never reads as a UI
// highlight on the tile.
//
// It is also an AREA and not a line. The first passes drew a bright crest with
// a narrow lip strip laid along the top of it, and at this camera one clean
// curved highlight is a SWORD SLASH — the motif read as a blade going through
// the card, in every colour it was tried in. What reads as water instead is
// the card going UNDER something: a band of dark blue-green that covers it,
// with one modest foam edge at the waterline and the wrinkles of a surface
// inside it. The only bright thing is the foam, and it is broken.
//
// One effect, one file.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&at=300" \
//             --eval tools/fxdemo/cast-marvorren.js --out /tmp/cm.png --settle 900
// ?at is milliseconds INTO the motif (see the harness) — wall-clock --settle
// lands wherever the frame rate feels like on the day.

import { THREE, easeIn } from '../kit.js';

/**
 * Where the flat parts lie. `kit.at` answers 0.4 for a bare square but about
 * 0.2 for a card, whose face is at ~0.22.
 *
 * The clearance is 0.055 and not the 0.03 this started with: at 0.03 the flat
 * parts of the sheet land ON the card face to within a rounding error, lose
 * the depth test (gl.LESS fails on equal), and the wet the wave leaves behind
 * was drawn on the stone around the card but not on the card itself.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

// kit.hold hands the tick a FRACTION of the span, not seconds, so every moment
// below is a fraction and SPAN is the only number in time. Getting this wrong
// silently ran the first pass at 0.85 of the speed it was written for.
const SPAN = 0.68;
const CROSS = 0.72;       // the waterline reaches the far corner
const HU = 1.52;          // half the distance it travels
const HV = 1.20;          // half its width
// Sheet grid. NU is set by the FOAM, not by the swell: the foam band is about
// 0.13 across and a mesh can only draw what its vertices carry, so at the 56
// columns this started with, the waterline was two cells wide, interpolated
// into a soft smear, and the wave had no edge at all. 88 gives it four.
const NU = 88, NV = 24;
const AMP = 0.14;         // crest height
const SIG = 0.30;         // swell half-width
const LAM = 0.52;         // spacing of the swells behind the leading one
const BOW = 0.26;         // how far the middle of the waterline runs ahead
const TRAIL = 1.05;       // how far the water reaches back from the waterline

// The sun sits at (-13,15,9), so a front travelling toward -x/+z turns its
// face INTO the light and toward the camera. Away from either and the leading
// face of the wave is the one in shadow, which is the wrong way round.
const YAW = -Math.PI * 0.75;

// Marvorren card art is ITSELF blue-green — Sea Soldiers, Tideborne Hunters,
// the whole faction is painted in this motif's own colours — so hue buys
// nothing: a blue wash over a blue card is invisible. What the eye has left is
// VALUE, and that is how the wave is built: dark water, a darker line under
// its lip, and one pale edge. FACTION.Marvorren's pair is the starting point
// but cannot be used as given; one tint cannot carry both the depth and the
// foam, so it is pushed dark for the body and pale for the crest. SKY is the
// faction's spark kept as it is, for the caustics, which is the one place a
// bright saturated cyan belongs.
const DEEP = new THREE.Color(0x051d2c);
const MID = new THREE.Color(0x12657f);
const FOAM = new THREE.Color(0x7fdff2);
const SKY = new THREE.Color(0x6fd6e8);
const BRINK = new THREE.Color(0x02101a);

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The small standing wrinkles on the surface, which the slope shade catches
 *  as glints. Flat water the colour of a poster is the thing to avoid here. */
function wrinkle(d, v) {
  return Math.sin(v * 9.3 + d * 7.4) * Math.sin(d * 4.6 - 1.4);
}

/**
 * The height of the water at distance `d` ahead of (positive) or behind
 * (negative) the waterline.
 *
 * A wave TRAIN, not one hump: a single crest is a bar sliding past, and three
 * in step are water. The lead swell sits just behind the waterline, and the
 * two behind it are lower and broader so the shape still has one clear front.
 */
function swell(d) {
  const lead = Math.exp(-((d + 0.16) ** 2) / (2 * SIG * SIG));
  const second = 0.46 * Math.exp(-((d + LAM + 0.16) ** 2) / (2 * (SIG * 1.35) ** 2));
  const third = 0.22 * Math.exp(-((d + LAM * 2 + 0.16) ** 2) / (2 * (SIG * 1.8) ** 2));
  const dip = -0.16 * Math.exp(-((d + LAM * 0.5) ** 2) / (2 * (SIG * 1.1) ** 2));
  return lead + second + third + dip;
}

/**
 * The swell, sampled once into a table. It is asked for THREE times a vertex —
 * the height, and a finite difference either side of it for the slope shade —
 * so four exponentials a call over two thousand vertices cost 0.75ms a tick on
 * the effect that fires more often than any other. The table, with the per-row
 * hoist in the tick below, brings that to 0.48ms for the same picture. Its
 * step is far finer than the 0.3 the narrowest swell is wide, and past its
 * ends the swell is zero to fifteen decimal places.
 */
const LUT_R = 3.2;
const LUT = new Float32Array(1024);
for (let i = 0; i < LUT.length; i++) {
  LUT[i] = swell(-LUT_R + (2 * LUT_R * i) / (LUT.length - 1));
}
const LUT_K = (LUT.length - 1) / (2 * LUT_R);

function profile(d) {
  const x = (d + LUT_R) * LUT_K;
  if (x <= 0 || x >= LUT.length - 1) return 0;
  const i = x | 0;
  return LUT[i] + (LUT[i + 1] - LUT[i]) * (x - i);
}

/** A grid of quads in the local xz plane, with room for per-vertex RGBA. */
function sheetGeo() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NU * NV * 3);
  for (let i = 0; i < NU; i++) {
    const u = -HU + (2 * HU * i) / (NU - 1);
    for (let j = 0; j < NV; j++) {
      const n = (i * NV + j) * 3;
      pos[n] = u;
      pos[n + 2] = -HV + (2 * HV * j) / (NV - 1);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NU * NV * 4), 4));
  const idx = [];
  for (let i = 0; i < NU - 1; i++) {
    for (let j = 0; j < NV - 1; j++) {
      const a = i * NV + j;
      idx.push(a, a + 1, a + NV, a + 1, a + NV + 1, a + NV);
    }
  }
  geo.setIndex(idx);
  return geo;
}

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const g = new THREE.Group();
  g.position.copy(p).setY(flatY(p));
  g.rotation.y = YAW;

  // Unlit on purpose. The key light is a warm low sun and a teal surface lit
  // by it goes grey-green; every colour here is hand-placed in the vertex
  // attribute instead, and the form is carried by the slope shade below.
  const sheet = new THREE.Mesh(sheetGeo(), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  sheet.renderOrder = 1;
  g.add(sheet);

  // One sheet and nothing else, which took removing two things that sounded
  // right. A cold point light riding the waterline put a soft cyan pool on the
  // card that swamped every edge the water had — and a travelling glow is
  // something any faction could own. Spray sprites are camera-facing discs,
  // and half a dozen of them sitting in the water read as lens bokeh: bright
  // round dots the eye goes to instead of the card.

  const sPos = sheet.geometry.attributes.position.array;
  const sCol = sheet.geometry.attributes.color.array;
  const c = new THREE.Color();

  // Per-ROW scratch, filled at the top of each tick. Everything that depends
  // only on how far across the wave you are — the taper, the ragged foam, the
  // bowed waterline — used to be recomputed for all 88 columns of that row,
  // which is five sines a vertex for five sines' worth of answer. Held per
  // cast rather than per module so two overlapping casts cannot share it.
  const ARC = new Float32Array(NV);
  const RAG = new Float32Array(NV);
  const RIDGE = new Float32Array(NV);
  const TAIL = new Float32Array(NV);

  kit.hold(g, SPAN, (t) => {
    const run = Math.min(1, t / CROSS);
    // Loses way as it goes, the way a wave running up a beach does. Linear
    // travel read as a wipe — a UI transition, not water.
    const front = -HU + 2 * HU * run ** 0.82;
    const env = smooth(t / 0.09) * (1 - easeIn(Math.max(0, t - CROSS) / (1 - CROSS)));
    const dry = 1 - easeIn(Math.max(0, t - 0.5) / 0.5);

    for (let j = 0; j < NV; j++) {
      const v = -HV + (2 * HV * j) / (NV - 1);
      const w = v / HV;
      // The arc curves the waterline in PLAN, which is the half of the read
      // that survives this steep a camera, and the wobble keeps it off a
      // perfect circle, which looked machined. The taper is the fiddly part:
      // a cosine across the width made the water a lens thickest down its own
      // middle with no width to the wave, and a flat top with a short taper
      // made it a BAR with square ends. A third of the half-width is full in
      // the middle, round at the ends, and dead before the next square.
      ARC[j] = smooth((1 - Math.abs(w)) / 0.38) * (0.88 + 0.12 * Math.sin(v * 7.7));
      // Foam is ragged. A clean even band along the waterline read as a strip
      // of tape, so it is cut by a fixed two-frequency wobble and never quite
      // closes across the front.
      RAG[j] = 0.55 + 0.25 * Math.sin(v * 12.4 + 0.7) + 0.2 * Math.sin(v * 5.1 + 2.2);
      RIDGE[j] = front + BOW * (1 - w * w) + 0.035 * Math.sin(v * 5.3 + 1.1);
      TAIL[j] = TRAIL + 0.18 * Math.sin(v * 6.1 + 2.3);   // it drains in fingers
    }

    for (let i = 0; i < NU; i++) {
      const u = -HU + (2 * HU * i) / (NU - 1);
      // It rises out of the stone and sinks back into it rather than sliding
      // in from off the square: water with a visible beginning at the tile
      // edge looked like a card being dealt over it, and it must not reach
      // the neighbouring squares at all.
      const edge = Math.cos((u / HU) * Math.PI * 0.5) ** 0.5;
      for (let j = 0; j < NV; j++) {
        const v = -HV + (2 * HV * j) / (NV - 1);
        const arc = ARC[j];
        const d = u - RIDGE[j];

        // The covered area — the whole motif is that the card goes UNDER this
        // and comes back out. A hard leading edge, and a long soft tail.
        const cover = smooth((0.03 - d) / 0.1) * smooth((d + TAIL[j]) / 0.55) * edge * arc;
        const h = profile(d);
        const wrink = 0.02 * wrinkle(d, v);
        const n = (i * NV + j) * 3;
        const n4 = (i * NV + j) * 4;
        sPos[n + 1] = (AMP * h * arc * edge + wrink * cover) * env;

        // Slope shade: the face tipped toward the light is brighter. Without
        // it an unlit sheet is a flat decal and the swells have no volume.
        const slope = (profile(d - 0.07) - profile(d + 0.07)) * arc * edge * 2.6
          + (wrinkle(d - 0.05, v) - wrinkle(d + 0.05, v)) * cover * 0.5;
        const up = Math.max(0, Math.min(1, h * arc * edge));
        c.copy(DEEP).lerp(MID, up ** 1.2);
        // Caustics: the bright net of light the surface throws on what is
        // under it. Two crossed travelling waves, raised to a power so only
        // the ridges survive as thin lines. This is the one cue nothing else
        // on the table has, and it reads at card size where a silhouette does
        // not — the board is seen from almost overhead.
        const net = Math.sin(v * 5.1 + d * 3.3 + t * 9) * Math.sin(v * 3.2 - d * 4.7 - t * 6);
        // ^6 and a small weight: at ^5 x 1.6 the net drove the vertex colour
        // well past white, the filmic tone mapping flattened the whole band to
        // a pale blob, and the wave lost every edge it had.
        const caustic = Math.max(0, net) ** 6 * cover * 0.75;
        c.lerp(SKY, Math.min(1, caustic * 0.6));
        // The brink: the dark line the lip of the wave throws on the dry stone
        // just ahead of itself. It is what makes the waterline an EDGE — foam
        // alone on a lit card is a smear with nothing to be an edge of.
        const brink = Math.exp(-(((d - 0.085) / 0.07) ** 2)) * arc ** 0.6 * edge;
        c.lerp(BRINK, Math.min(1, brink * 1.8));
        // Foam, and ONLY here: a narrow broken band at the waterline.
        // arc**0.4, not arc: tied to the full width fade the foam was brightest
        // at the middle of the arc and tapered to a point at both ends, which
        // is a STREAK — a dash drawn across the card. An edge has to hold its
        // weight along its whole length and then simply stop.
        const foam = Math.exp(-(((d + 0.03) / 0.055) ** 2)) * RAG[j] * arc ** 0.4 * edge;
        c.lerp(FOAM, Math.min(1, foam * 1.15));
        const shade = 0.8 + Math.max(-0.4, Math.min(0.5, slope)) + caustic * 0.35;
        // Wet stone behind the water, drying off after it.
        const wet = d < -TRAIL ? 0.3 * Math.exp((d + TRAIL) / 0.6) * dry * edge * arc : 0;
        sCol[n4] = c.r * shade; sCol[n4 + 1] = c.g * shade; sCol[n4 + 2] = c.b * shade;
        sCol[n4 + 3] = Math.min(1, env
          * (cover * (0.68 + 0.3 * up) + foam * 0.68 + brink * 0.85 + wet));
      }
    }
    sheet.geometry.attributes.position.needsUpdate = true;
    sheet.geometry.attributes.color.needsUpdate = true;
  });
}
