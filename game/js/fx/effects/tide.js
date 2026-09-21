// A TIDE sweeping a whole row of fighters along with it.
//
// Shared by 3 cards: M035 Tidal Wave, M003 Scylla, M041 Temple of Tides.
// One motif, one file — worked on on its own.
//
// THE SCALE IS THE MOTIF. The faction's everyday flourish (cast-marvorren.js)
// is a sheet of water crossing ONE card diagonally; this is the same element
// three squares long. So it cannot be that wave scaled up — at four times the
// length the same shape is just a bigger decal. What makes it a different
// event is that the water ARRIVES AND STAYS: a wall runs the length of the
// row, the whole row goes under and is held under, a second surge comes
// through behind the first, the fighters ride up on it and are carried along
// together, and only then does it drain off the far end. Nothing else on the
// table covers three squares, and nothing else moves cards without moving
// them.
//
// It runs ALONG the row rather than across it. Across was the first idea — one
// crest spanning all three squares, sweeping toward the camera — and it has
// nowhere to go: a row is one square deep, so the front would have to stop
// dead after two units of travel, and water that stops dead is a wipe. Along
// the row there are nine units of run, and the square's two long edges become
// BANKS, which is what makes the flood a channel and not a rectangle drawn
// over the row.
//
// Direction: the water enters from +x (screen right) and runs to -x. The sun
// is at (-13,15,9), so a front travelling that way turns its face into the
// light; the other way round the leading face — the one thing that has to be
// read — is the face in shadow.
//
// Borrowed wholesale from the flourish, because that file paid for it:
// Marvorren card art is ITSELF blue-green, so the picture is built on VALUE,
// not hue — near-black water, a darker line on the stone ahead of the lip, and
// white only where it breaks. The sheet is unlit and every colour is placed by
// hand per vertex, because a teal surface under a warm key light goes
// grey-green. Caustics are the one cue that survives at card size seen from
// almost overhead.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=900" \
//             --eval tools/fxdemo/tide.js --out /tmp/tide.png --settle 900
// ?t is milliseconds INTO the motif and ?zoom=row|0|1|2 drops the camera in on
// it (see the harness) — wall-clock --settle lands wherever the frame rate
// feels like on the day.

import { THREE } from '../kit.js';
import { STEP } from '../../arena.js';

/**
 * Where the flat parts lie. `kit.at` answers 0.4 for a bare square but about
 * 0.2 for a card, whose face is at ~0.22. The clearance is 0.055: at 0.03 the
 * flat water lands ON the card face to within a rounding error, loses the
 * depth test (gl.LESS fails on equal) and is drawn on the stone around the
 * card but not on the card itself.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

// kit.hold hands the tick a FRACTION of the span, not seconds, so every moment
// below is a fraction and SPAN is the only number in time.
const SPAN = 2.2;         // slow. A tide is not an impact.
const CROSS = 0.42;       // the first waterline reaches the far end
const WAKE = 0.24;        // the second surge sets off
const WAKE_RUN = 0.52;    // ...and takes longer over the same ground
const DRAIN = 0.60;       // the back edge starts chasing them off the board
const HU = 5.4;           // half the length: the row plus a run-up either end
const HV = 1.55;          // half the width: the row's own square, plus banks
// Grid. NU is set by the FOAM — a mesh can only draw what its vertices carry,
// and the foam bands are about 0.12 across — and NV has to MATCH it. At 208x30
// the rows were twice as far apart as the columns, which is under two vertices
// per wave for the caustics and the foam streaks: they came back as moire
// speckle, a static of cyan dashes over the cards, and no amount of retuning
// the patterns helped because the patterns were not the problem. 176x48 is
// 0.061 by 0.065 — square cells, and every frequency below them fits.
const NU = 176, NV = 48;
// Crest height above the card plane. 0.42 was the first try and the wave was a
// RUMPLE: nine pixels of lift at this camera, which at a glance is a blue band
// lying on the stone. A card is 1.74 across, so a crest half of that stands up
// like a wall, hides what it passes over, and is most of the reason the thing
// reads as big rather than as the flourish stretched out.
const AMP = 0.9;
const WAKE_AMP = 0.42;    // the second surge, as a share of the first
const RIP = 0.09;         // the heave on the held flood
const SIG = 0.34;         // swell half-width
const LAM = 1.15;         // spacing of the swells behind the leading one
const BOW = 0.6;          // how far the middle of the waterline runs ahead
const CURL = 0.22;        // how far the crest overhangs its own foot
const SHOVE = 0.34;       // how far along the row a fighter is carried

// The banks. HALF is the water's half-width where it is widest; the row's
// square is 2.5 across, so at 1.08 the flood fills its own stone and dies in
// the joint before the next row.
const HALF = 1.08;

const DEEP = new THREE.Color(0x02101b);
const MID = new THREE.Color(0x0e5670);
const FOAM = new THREE.Color(0xddf6ff);
const SKY = new THREE.Color(0x6fd6e8);
const BRINK = new THREE.Color(0x02101a);

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * The height of the water at distance `d` ahead of (positive) or behind
 * (negative) the waterline.
 *
 * A wave TRAIN, not one hump: one crest sliding past is a bar, three in step
 * are water. Behind the train the surface goes flat and the travelling ripple
 * carries it instead — this is a flood, which is deep water with a front on
 * it, not a ridge running over dry stone.
 */
function swell(d) {
  // THE TOE. Without it the crest was nearly at full height AT the waterline,
  // so the sheet's leading edge was a cliff whose foot was nowhere and the
  // wave hovered over the stone it was supposed to be running across. Water is
  // zero deep where it meets dry ground; the face climbs from there.
  const toe = d >= 0 ? 0 : smooth(-d / 0.22);
  // Asymmetric, because a symmetric hump is a DUNE — whatever else was done to
  // it, a Gaussian crest read as a smooth rounded lump lying on the row. Steep
  // in front and long behind is the shape of a swell about to break.
  const x = d + 0.35;
  const sig = x > 0 ? SIG * 0.62 : SIG * 1.25;
  const lead = toe * Math.exp(-(x * x) / (2 * sig * sig));
  const second = 0.5 * Math.exp(-((d + LAM + 0.35) ** 2) / (2 * (SIG * 1.5) ** 2));
  const third = 0.27 * Math.exp(-((d + LAM * 2 + 0.35) ** 2) / (2 * (SIG * 2) ** 2));
  const dip = -0.18 * Math.exp(-((d + LAM * 0.6) ** 2) / (2 * (SIG * 0.9) ** 2));
  return lead + second + third + dip;
}

// The swell, sampled once into a table. It is asked for six times a vertex —
// the height and a finite difference either side of it, for each of the two
// fronts — and four exponentials a call over eight thousand vertices is
// milliseconds a tick. The step is far finer than the narrowest part of the
// swell, and past the ends of the table it is zero to fifteen places.
const LUT_R = 6.5;
const LUT = new Float32Array(2048);
for (let i = 0; i < LUT.length; i++) {
  LUT[i] = swell(-LUT_R + (2 * LUT_R * i) / (LUT.length - 1));
}
const LUT_K = (LUT.length - 1) / (2 * LUT_R);
// What the crest actually reaches, measured rather than assumed. The white cap
// is keyed off the height, and while its threshold was an absolute number the
// cap vanished silently the moment the swell was retuned and the peak moved a
// few hundredths — the wave simply stopped breaking, with nothing in the code
// to say why.
const PEAK = LUT.reduce((a, b) => (b > a ? b : a), 0);

function profile(d) {
  const x = (d + LUT_R) * LUT_K;
  if (x <= 0 || x >= LUT.length - 1) return 0;
  const i = x | 0;
  return LUT[i] + (LUT[i + 1] - LUT[i]) * (x - i);
}

// exp(-x*x), tabled for the same reason: the foam line, the dark brink and the
// caustics each want one per vertex, and three exps over eight thousand
// vertices is a third of the tick on its own. Past |x|=4 it is 1e-7.
const BELL = new Float32Array(1024);
for (let i = 0; i < BELL.length; i++) {
  const x = (4 * i) / (BELL.length - 1);
  BELL[i] = Math.exp(-x * x);
}
const BELL_K = (BELL.length - 1) / 4;

function bell(x) {
  const a = (x < 0 ? -x : x) * BELL_K;
  if (a >= BELL.length - 1) return 0;
  const i = a | 0;
  return BELL[i] + (BELL[i + 1] - BELL[i]) * (a - i);
}

/**
 * One travelling sine over the sheet, held as four small tables.
 *
 * Every pattern here — the heave, the caustic net, the foam streaks — is
 * sin(ku*u + kv*v + phase), and evaluating
 * those straight costs about twenty sines a vertex, which measured 2.1ms a
 * tick over this grid. sin(A+B) = sinA cosB + cosA sinB, so a table of sinA
 * and cosA per COLUMN and of sinB and cosB per ROW answers any vertex in two
 * multiplies — and answers the slope along u exactly, from the same four
 * numbers, instead of by evaluating the whole pattern twice more.
 *
 * The v tables never change; the u tables are rebuilt once a tick for the
 * patterns that travel, which is a few hundred sines rather than a few
 * hundred thousand.
 */
function ripples(ku, kv, U, V, warp) {
  const su = new Float32Array(NU), cu = new Float32Array(NU);
  const sv = new Float32Array(NV), cv = new Float32Array(NV);
  for (let j = 0; j < NV; j++) { sv[j] = Math.sin(kv * V[j]); cv[j] = Math.cos(kv * V[j]); }
  // `warp` bends the pattern column by column. The foam streaks need it: they
  // run the length of the row, and a pattern that is straight in u is two
  // dozen parallel lines three squares long — corduroy, not foam.
  const phase = (ph) => {
    for (let i = 0; i < NU; i++) {
      const a = ku * U[i] + ph + (warp ? warp[i] : 0);
      su[i] = Math.sin(a); cu[i] = Math.cos(a);
    }
  };
  phase(0);
  return {
    phase,
    at: (i, j) => su[i] * cv[j] + cu[i] * sv[j],
    du: (i, j) => ku * (cu[i] * cv[j] - su[i] * sv[j]),
  };
}

/** A grid of quads in the local xz plane, with room for per-vertex RGBA. */
function sheetGeo(U, V) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NU * NV * 3);
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const n = (i * NV + j) * 3;
      pos[n] = U[i];
      pos[n + 2] = V[j];
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

/** Which row the card that resolved is standing in. A Stronghold or a loose
 *  reference has no square, so the z of the position answers instead. */
function rowOf(kit, ref, p) {
  const piece = kit.piece(ref);
  if (piece && piece.square >= 0 && piece.square < 9) return Math.floor(piece.square / 3);
  return Math.max(0, Math.min(2, Math.round(1 - p.z / STEP)));
}

export function tide(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const row = rowOf(kit, at, p);
  const rowZ = (1 - row) * STEP;

  const g = new THREE.Group();
  g.position.set(0, flatY(p), rowZ);
  // Local +u is world -x, which is where the water is going and where the sun
  // is. Local +v is world -z; the row is symmetric across it, so that costs
  // nothing.
  g.rotation.y = Math.PI;

  const U = new Float32Array(NU), V = new Float32Array(NV);
  for (let i = 0; i < NU; i++) U[i] = -HU + (2 * HU * i) / (NU - 1);
  for (let j = 0; j < NV; j++) V[j] = -HV + (2 * HV * j) / (NV - 1);

  // Unlit on purpose: the key light is a warm low sun and a teal surface under
  // it goes grey-green. Every colour here is placed in the vertex attribute and
  // the form is carried by the slope shade below.
  const sheet = new THREE.Mesh(sheetGeo(U, V), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  sheet.renderOrder = 1;
  g.add(sheet);

  // THE FIGHTERS THE TIDE IS FOR. Every card standing in the row, buried ones
  // included — a stack goes under together. `restingPosition` and not the
  // current position: a card caught mid-lerp would be handed back to a place
  // it was only passing through.
  const riders = [];
  for (const piece of kit.pieces?.byUid?.values?.() || []) {
    if (piece.square == null || piece.square < 0 || piece.square > 8) continue;
    if (Math.floor(piece.square / 3) !== row) continue;
    riders.push({ piece, home: piece.restingPosition?.() || piece.group.position.clone() });
  }

  const sPos = sheet.geometry.attributes.position.array;
  const sCol = sheet.geometry.attributes.color.array;
  const c = new THREE.Color();

  // The heave on the held flood: two long waves running the way the water runs
  // and one shorter cross wave. The first pass had 3cm wrinkles here and the
  // held flood was a flat slab of blue three squares long, which at this
  // camera is a painted rectangle. What held water wants is the SLOW heave —
  // waves about as long as a card, deep enough for the slope shade to find a
  // lit face and a dark one.
  const HEAVE = [
    { w: ripples(4.4, 0.8, U, V), amp: 1, speed: -7.0 },
    { w: ripples(2.5, -1.7, U, V), amp: 0.62, speed: -4.4 },
    { w: ripples(1.1, 5.3, U, V), amp: 0.35, speed: 2.2 },
  ];
  // The caustic net. CONTOURS, not a product of sines: two crossed sines
  // raised to a power — what the flourish uses, and right for one card — tile
  // a three-square row with a regular lattice of round DOTS, polka dots on the
  // cards that the eye finds instantly. The zero contour of a sum of three
  // waves wanders, never closes into a repeat, and is a LINE, which is what a
  // caustic is. The scale matters as much: at a contour every 0.8 units it
  // drew glowing loops the size of a fighter's head and the row read as neon
  // piping. A caustic is finer than the thing it falls on.
  const NET = [
    { w: ripples(7.7, 12.6, U, V), amp: 1, speed: 5.5 },
    { w: ripples(12.3, -8.1, U, V), amp: 0.9, speed: -4.1 },
    { w: ripples(18.5, 5.1, U, V), amp: 0.5, speed: 2.3 },
  ];
  // Torn foam left behind the break: lines across the channel, broken into
  // lengths along it, and given a phase each tick so they drift on with the
  // flow.
  const WARP = new Float32Array(NU);
  for (let i = 0; i < NU; i++) WARP[i] = Math.sin(U[i] * 1.1) * 3.4 + 1.1;
  const STREAK = ripples(0, 12.6, U, V, WARP);
  const DRIFT = ripples(5.3, 2.4, U, V);

  // Per-column and per-row scratch. The bank wobble depends only on u and the
  // bowed waterline only on v; computing either per vertex is fifty sines for
  // one sine's worth of answer. Held per cast, not per module, so two
  // overlapping tides cannot share them.
  const HW = new Float32Array(NU);
  const EDGE = new Float32Array(NU);
  const BANK = new Float32Array(NU);
  const RIDGE = new Float32Array(NV);
  const WRIDGE = new Float32Array(NV);
  const RAG = new Float32Array(NV);

  for (let i = 0; i < NU; i++) {
    const u = U[i];
    // Banks that wander, at a scale you can SEE. At +-0.15 over wavelengths
    // five units long they were two straight lines three squares long and the
    // flood read as a lit UI band under the row. A card is 1.74 across, so the
    // bank has to move within that.
    HW[i] = HALF + 0.1 * Math.sin(u * 1.3 + 0.7) + 0.11 * Math.sin(u * 3.7 - 1.1)
      + 0.05 * Math.sin(u * 8.1);
    // The ends fade out rather than stopping: a sheet with a square end is a
    // card being dealt over the board. Both ends are off the row's own stone.
    EDGE[i] = smooth((HU - Math.abs(u)) / 1.5) ** 0.7;
    // Foam against the bank, broken along its length so it is not a drawn line.
    BANK[i] = 0.5 + 0.5 * Math.sin(u * 4.1 + 1.7) * Math.sin(u * 1.7);
  }
  for (let j = 0; j < NV; j++) {
    // Foam is ragged and never quite closes across the front. A clean even
    // band along the waterline is a strip of tape.
    RAG[j] = 0.55 + 0.26 * Math.sin(V[j] * 9.4 + 0.7) + 0.2 * Math.sin(V[j] * 4.1 + 2.2);
  }

  kit.hold(g, SPAN, (t) => {
    // Both fronts lose way as they go, the way water running up a beach does.
    // Linear travel read as a wipe — a UI transition, not a wave.
    const run = clamp01(t / CROSS);
    const front = -HU + (2 * HU + 1.2) * run ** 0.72;
    // The second surge. The held flood was the dead part of the motif: a
    // minute of screen time where the only motion was sparkle. A tide is not
    // one wave, so another one comes through behind the first, lower and
    // slower, and breaks its own crest on the way past.
    const wrun = clamp01((t - WAKE) / WAKE_RUN);
    const wfront = -HU + (2 * HU + 1.2) * wrun ** 0.72;
    const env = smooth(t / 0.07);
    // The drain: the back edge chases the fronts off the far end, uncovering
    // the row from the end the water came in at. Holding the flood and then
    // fading the sheet out was the first try and it read as a light being
    // switched off — water has to LEAVE. Nor on an easeIn: a cubic spends most
    // of its length near zero, so at four fifths of the motif the edge had
    // moved a tenth of the row and the flood simply sat there.
    const drain = clamp01((t - DRAIN) / (0.97 - DRAIN)) ** 1.6;
    const back = -HU - 1.4 + (2 * HU + 3.0) * drain;
    const dry = 1 - clamp01((t - 0.82) / 0.18);

    for (const h of HEAVE) h.w.phase(h.speed * t);
    for (const n of NET) n.w.phase(n.speed * t);
    // Minus, so the foam drifts the way the water is going. It was plus, and
    // the streaks crawled slowly UPSTREAM through a flood running the other
    // way, which is the sort of thing that reads as wrong before it reads as
    // anything.
    DRIFT.phase(-5.3 * 2.2 * t);

    for (let j = 0; j < NV; j++) {
      const v = V[j];
      const w = v / HV;
      // The waterline bows: the middle of the channel runs ahead of the water
      // at the banks, where the stone drags on it. A straight front across a
      // 2.5-wide channel is a ruler. The second surge bows less — it is not
      // being driven as hard.
      RIDGE[j] = front + BOW * (1 - w * w) + 0.05 * Math.sin(v * 4.7 + 1.1);
      WRIDGE[j] = wfront + BOW * 0.55 * (1 - w * w) - 0.07 * Math.sin(v * 3.9 - 0.6);
    }

    for (let i = 0; i < NU; i++) {
      const u = U[i];
      const edge = EDGE[i];
      const hw = HW[i];
      const bankU = BANK[i];
      for (let j = 0; j < NV; j++) {
        const v = V[j];
        const n = (i * NV + j) * 3;
        const n4 = (i * NV + j) * 4;
        const d = u - RIDGE[j];
        const dw = u - WRIDGE[j];
        // Across the channel: full in the middle of the row, dead in the joint
        // before the next one. The 0.34 of fade is the difference between a
        // flood with a waterline at its banks and a band with an airbrushed
        // edge.
        const arc = smooth((hw - Math.abs(v)) / 0.34);
        // Covered: ahead of the waterline is dry stone, behind it is water all
        // the way back to whatever the drain has uncovered.
        const cover = smooth((0.02 - d) / 0.05) * smooth((u - back) / 0.8) * edge * arc;
        const lead = profile(d) * arc * edge;
        const wake = profile(dw) * arc * edge * WAKE_AMP;
        const h = lead + wake;

        let rip = 0, drip = 0;
        for (let k = 0; k < 3; k++) {
          rip += HEAVE[k].amp * HEAVE[k].w.at(i, j);
          drip += HEAVE[k].amp * HEAVE[k].w.du(i, j);
        }

        sPos[n + 1] = (AMP * h + RIP * rip * cover) * env;
        // The curl: the crest is carried forward over its own foot, so the
        // leading face stands up instead of sloping away. Only a little of it —
        // at three times this the foam and the shading on the front face were
        // stretched across half a square of screen and the wave had a soft
        // grey nose with no detail in it anywhere.
        sPos[n] = u + CURL * Math.max(0, h) ** 1.6 * smooth((d + 1.1) / 0.9);

        // Slope shade: the face tipped toward the light is brighter. Without
        // it an unlit sheet is a flat decal and the swells have no volume. The
        // ceiling is 0.75 and not the 1.1 it started at: on the steep front of
        // a crest this big the term ran to nearly double brightness, the
        // filmic tone mapping took the rest, and the leading face came out a
        // blown white wall with no colour left in it.
        const slope = (profile(d - 0.09) - profile(d + 0.09)) * arc * edge * 2.2
          + (profile(dw - 0.09) - profile(dw + 0.09)) * arc * edge * WAKE_AMP * 2.2
          - drip * RIP * cover * 1.2;
        // up**2.4, not up: at a linear mix the whole crest — a hump a unit
        // long — came out mid-teal, and a mid-teal mass that size is a plastic
        // sheet. Deep water is nearly black; only the last of the height, the
        // part about to break, has any colour in it.
        const up = clamp01(h);
        c.copy(DEEP).lerp(MID, up ** 2.4);
        // The caustic net, tied to the heave: light focuses under the crest of
        // a ripple and scatters under its trough, so the net brightens and
        // dims in bands that travel with the water. Left flat it is an even
        // speckle over the whole row, which reads as static, not as light.
        const net = NET[0].w.at(i, j) + NET[1].amp * NET[1].w.at(i, j)
          + NET[2].amp * NET[2].w.at(i, j);
        const caustic = bell(net * 4) * cover * (1 - up * 0.7)
          * (0.35 + 0.65 * clamp01(rip * 0.6 + 0.5));
        c.lerp(SKY, Math.min(1, caustic * 0.4));
        // The brink: the dark line the lip throws on the dry stone ahead of
        // itself. It is what makes the waterline an EDGE — foam alone on lit
        // stone is a smear with nothing to be an edge of.
        const brink = bell((d - 0.16) / 0.2) * arc ** 0.6 * edge;
        c.lerp(BRINK, Math.min(1, brink * 2.2));

        // FOAM, which is the only bright thing here and the only part of the
        // wave that reads at sixty pixels a card.
        //
        // The CAP is the white water on top of the wall. It is keyed off the
        // HEIGHT and not off a band in d, so it follows the bow of the crest
        // for free and thins out wherever the crest is lower: a band in d is a
        // stripe painted along the wave, this is the top of it BREAKING. The
        // threshold is a fraction of the measured peak rather than an absolute
        // height — as an absolute it silently stopped breaking the first time
        // the swell was retuned. There is no second band of foam anywhere down
        // the face; one was tried and the wall came out pale grey, an ice
        // shelf rather than water. Weighting the white toward the lip was
        // tried too, and only halved the amount of white there was.
        //
        // The mottle that tears the cap comes off the SAME three waves as the
        // caustics. Two crossed sines at the scale of half a card gave big
        // soft blobs and the crest broke into smooth pale satin — a bedsheet
        // laid over the row — where three waves clipped hard tear at a fifth
        // of a card, which is what foam does, and cost nothing because they
        // are already on the table.
        const mottle = clamp01(0.55 + 0.5 * net);
        const cap = (smooth((lead / PEAK - 0.74) / 0.16)
          + smooth((wake / (PEAK * WAKE_AMP) - 0.82) / 0.13) * 0.45)
          * mottle * arc * edge;
        // The thin white line where the water meets dry stone, which is what
        // the eye reads as the edge of the flood under the overhang.
        const line = bell((d + 0.02) / 0.05) * RAG[j] * arc ** 0.35 * edge * 0.7;
        // What the break leaves behind: foam torn into streaks running the way
        // the water runs, which is what gives the held flood a direction after
        // the crest has gone. Thin, patchy and CARRIED — at a stripe every
        // third of a unit, held still, running the full three squares, this
        // was corduroy, a woven texture laid over the row.
        const trail = clamp01((-d - 0.2) / 0.55) * Math.exp((d + 0.2) / 2.4);
        const s1 = STREAK.at(i, j), s2 = DRIFT.at(i, j);
        const streak = (s1 > 0 ? s1 ** 6 : 0) * (s2 > 0 ? s2 * s2 : 0);
        const bank = smooth((0.24 - Math.abs(Math.abs(v) - hw)) / 0.24) ** 3 * cover * bankU;
        const foam = Math.min(1.15, cap + line + trail * streak * 0.22 * cover + bank * 0.5);
        c.lerp(FOAM, Math.min(1, foam));

        const shade = 0.72 + Math.max(-0.5, Math.min(0.75, slope)) + caustic * 0.25;
        // Wet stone behind the drain, drying off after it, with the thin
        // bright line of the retreating waterline on the front of it. Without
        // the line the flood did not retreat, it was switched off square by
        // square.
        const wet = u < back
          ? (0.34 * Math.exp((u - back) / 0.9) + 0.5 * bell((u - back) / 0.09)) * dry * edge * arc
          : 0;
        sCol[n4] = c.r * shade; sCol[n4 + 1] = c.g * shade; sCol[n4 + 2] = c.b * shade;
        // The cap gets its own share of the alpha on top of the rest: foam is
        // the one part of this that is not see-through, and at the shared
        // weight the crest was a pale film with the stone showing through it.
        sCol[n4 + 3] = Math.min(1, env
          * (cover * (0.68 + 0.26 * up) + foam * 0.75 + cap * 0.5 + brink * 0.9 + wet));
      }
    }
    sheet.geometry.attributes.position.needsUpdate = true;
    sheet.geometry.attributes.color.needsUpdate = true;

    /* ---- the fighters, carried ---- */
    // `animating` is set every tick and not once: the board's own move tween
    // clears the flag when it ends, and a card whose flag was cleared mid-tide
    // snapped back to its square with the water still over it.
    const settle = 1 - smooth((t - 0.8) / 0.2);      // handed back before the end
    for (const r of riders) {
      const piece = r.piece;
      if (!piece.group.parent) continue;
      piece.animating = true;
      // Where the card stands along the channel, in the water's frame.
      const u = -r.home.x;
      const v = -(r.home.z - rowZ);
      const j = Math.max(0, Math.min(NV - 1, Math.round(((v + HV) / (2 * HV)) * (NV - 1))));
      const d = u - RIDGE[j];
      const dw = u - WRIDGE[j];
      const arc = smooth((HALF - Math.abs(v)) / 0.34);
      const lift = (profile(d) + profile(dw) * WAKE_AMP) * arc * env;
      // It rides the surface: up on the crest and tipped along the slope of
      // whatever is under it. Not the full slope — a card is a rigid thing
      // shorter than the swell, so it takes a share — and the tip is held
      // under 0.2rad, since past that a flat card standing on edge in a
      // 60-pixel square stops reading as a card at all.
      const tip = ((profile(d + 0.42) - profile(d - 0.42))
        + (profile(dw + 0.42) - profile(dw - 0.42)) * WAKE_AMP) * arc * env;
      const roll = Math.max(-0.2, Math.min(0.2, tip * 0.5)) * settle;
      piece.group.position.set(
        r.home.x - SHOVE * smooth(-d / 1.6) * settle,
        r.home.y + AMP * Math.max(0, lift) * 0.5,
        r.home.z,
      );
      piece.group.rotation.z = -roll;
      piece.group.rotation.x = roll * 0.35;
      r.held = piece.group.position.clone();
    }
  }, () => {
    for (const r of riders) {
      const piece = r.piece;
      // Hand the card back only if it is still where this left it. A tide can
      // kill — Scylla redraws whose Back Row is whose, and a fighter in the
      // wrong place dies for it — and the board's own destroy tween starts on
      // top of this one; restoring blind would yank a dying card back onto its
      // square mid-fall to the discard pile.
      if (!r.held || piece.group.position.distanceTo(r.held) > 1e-4) continue;
      piece.group.position.copy(r.home);
      piece.group.rotation.set(0, 0, 0);
      piece.animating = false;
    }
  });
}
