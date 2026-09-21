// THE MOON TURNING, beside your Stronghold.
//
// Shared by 1 card: M046 New Moon — "At the start of your Action Phase, if you
// control Scylla, rotate this card. After four rotations, flip this card over."
// One motif, one file — worked on on its own.
//
// THE ESCALATION IS THE MOTIF. This fires FOUR TIMES, once a turn, and the
// only thing it has to say is "nearer". So it is one function of `phase`, not
// four effects: a single lit fraction, a single reach, a single gain, and
// every part of the picture hangs off them. Phase 1 is a wet patch and a
// fingernail of light; phase 4 is a full moon over a pool that has burst its
// own rim and is running at the board. Judged the way a player meets it — the
// four frames side by side — anything that did not grow between them was cut.
//
// It also has to SURVIVE being seen four times, so it is small: one pool of
// dark water on the dirt beside the Stronghold, the moon over it, and the lane
// of moonlight it throws toward the back row. Nothing here is on the board
// until phase 3, and nothing here is loud.
//
// The card is NOT DRAWN by the table — New Moon lives in `state.beside`, which
// pieces.js never sees, so there is no object beside the Stronghold for this
// to decorate. The moon itself is the card, and this motif is the only thing
// that ever puts it on screen.
//
// THE WAX IS THE ROTATION. "Rotate this card" is shown literally: the moon's
// horns swing a quarter turn every time it fires, so after four firings it has
// come the whole way round — and the lit fraction grows across the same beat,
// so you watch it wax rather than being handed a bigger moon.
//
// THE MOON IS A SPHERE, AND THE PHASE IS THE LIGHTING. It used to be a Sprite
// with a canvas texture on it: the disc was an `arc()`, the craters were
// `arc()`, the crescent was a painted mask and the limb was a `stroke()`. It
// was rejected on sight and it deserved to be — everything else on this table
// is lit geometry, so a flat billboard with 2D shapes drawn on it reads as a
// sticker from another program. There is no painting left in here. The body is
// a displaced sphere and the crescent is the TERMINATOR between its lit and
// unlit hemispheres, which means it curves the way a real one does, at every
// fraction, for free, and the limb is a silhouette rather than a drawn circle.
// See ./moonphase's `makeMoon` for how it is lit without adding a scene light.
//
// Colour comes off the card face, which is a cream-green crescent with a cold
// white rim in a near-black navy socket. That cream is deliberately NOT the
// faction teal: three Marvorren motifs are already blue-green water (see
// ./tide.js, ./cast-marvorren.js, ./depthcharge.js), and the one thing on this
// table that has to read as MOONLIGHT cannot be the same colour as the sea it
// is pulling. The water underneath it is the faction's near-black, so the moon
// is the only bright thing in the frame — bought with SHADOW, the way the
// flourish buys its foam.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&p0=The%20Masked&t=400&phase=3" \
//             --eval tools/fxdemo/moonphase.js --out /tmp/mp.png \
//             --wait 9000 --settle 900
// ?t is milliseconds INTO the motif and ?phase is 1..4 (see the harness);
// wall-clock --settle lands wherever the headless frame rate feels like.

import { THREE } from '../kit.js';
import { strongholdPosition, CARD_W } from '../../board.js';
import { blobTexture } from '../../textures.js';

/* ------------------------------------------------------------ the phases */

// Everything that grows, in one table, so the four frames can be compared by
// reading four numbers instead of four code paths. `lit` is indexed by phase
// with a leading 0 because each firing animates from the PREVIOUS phase's moon
// to its own — the waxing has to happen on screen, not between turns.
const LIT = [0, 0.13, 0.31, 0.58, 1.0];
const SPAN = [0, 0.62, 0.80, 1.02, 1.42];   // seconds; the wait gets longer too
const POOL = [0, 0.74, 0.92, 1.12, 1.34];   // how far the water has spread
const REACH = [0, 0, 1.5, 3.3, 5.0];        // how far the lane of light runs
const MOON = [0.92, 1.06, 1.22, 1.40, 1.66];   // the moon's own size
const GAIN = [0, 0.42, 0.62, 0.82, 1.0];    // how bright the whole picture is
// Phase 4 is the only one where the water actually MOVES — a swell leaves the
// pool and runs the lane onto the board. Before that the pool only heaves.
const SURGE = [0, 0, 0, 0, 1];

/* ------------------------------------------------------------ the picture */

// The lane runs from the pool to the middle of the player's back row and a
// little past it. NU is set by the GLITTER — the dashes are about 0.15 long
// and a mesh can only draw what its vertices carry — and NV has to match it or
// the specks come back as moire.
const LEN = 5.4, BACK = 1.5;      // lane length ahead of the pool, and behind
const HV = 1.5;                   // half width of the sheet
const NU = 100, NV = 44;          // 0.069 by 0.068 — square cells

const DEEP = new THREE.Color(0x02101b);   // the pool, which is nearly black
const MID = new THREE.Color(0x0d4a63);
const GLINT = new THREE.Color(0xdcf0e8);  // moonlight ON water: cream, not teal
const FOAM = new THREE.Color(0xeafaff);
const SOCKET = new THREE.Color(0x060c16);  // the dark ring the pool sits in

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------- the moon */

// WHY A SPHERE AND NOT A SPRITE. The sprite was chosen because "the camera's
// elevation is fixed and cannot be flown around", so a disc laid flat in the
// world is seen at 52 degrees and reads as an ellipse. That argument only ever
// applied to a DISC. A sphere is round from every bearing, so the concern
// disappears entirely — and both seats' azimuths get the same moon for free.
// Do not revert this to a billboard: it was rejected for looking like "python
// coded 2d shapes", which is exactly what a canvas full of `ctx.arc()` is.

const MOON_VERT = `
  attribute float aShade;
  uniform float uTheta;   // angle between the sun and us, seen from the moon
  uniform float uRoll;    // where the horns point, about the line of sight
  varying vec3 vN;
  varying vec3 vE;
  varying vec3 vL;
  varying float vShade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // The moon's own centre in VIEW space, which is the one place the sun can
    // be built: the phase is defined by the angle at the moon between the sun
    // and the EYE, and in view space the eye is the origin, so no camera
    // uniform is needed and the two seats need no special case.
    vec3 centre = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 eye = normalize(-centre);
    // Screen up, made perpendicular to the line of sight. The horns roll about
    // this and nothing else, so the quarter turn is one number.
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = cross(up, eye);
    // Degenerate only if the moon were directly overhead, which this camera
    // cannot do — but a zero-length cross would make the whole moon black, and
    // that is not a failure anyone would diagnose quickly.
    right = length(right) > 1e-4 ? normalize(right) : vec3(1.0, 0.0, 0.0);
    up = cross(eye, right);
    vL = normalize(eye * cos(uTheta)
       + (right * cos(uRoll) + up * sin(uRoll)) * sin(uTheta));
    vN = normalize(normalMatrix * normal);
    vE = normalize(-mv.xyz);
    vShade = aShade;
    gl_Position = projectionMatrix * mv;
  }
`;

const MOON_FRAG = `
  uniform float uOpacity;
  uniform float uEarth;
  varying vec3 vN;
  varying vec3 vE;
  varying vec3 vL;
  varying float vShade;

  // The rock. Mare basalt is brown-grey and the highlands are a pale warm
  // cream; the difference between them is most of what a moon looks like.
  // The two rocks, and the numbers are LOW for the same reason the earthshine
  // ones are: ACES is almost flat at the top, so 0.90 of linear and 0.70 of
  // linear both come out around 0.89 on screen and the whole lit side
  // photographed as ONE WHITE BLOB with no maria and no craters in it. Down
  // here the same pair land at 0.85 and 0.57, which is the difference between
  // a moon and a hole punched in the sky.
  const vec3 MARE = vec3(0.165, 0.163, 0.150);
  const vec3 HIGH = vec3(0.560, 0.535, 0.450);
  // EARTHSHINE — the unlit side, which must NOT be black. A crescent hanging
  // over nothing is a comma; the whole ball faintly there behind the horns is
  // a moon, and this one detail does more for the thin phases than any crater.
  // Cold, because it is light that has been round the world once.
  //
  // MEASURED, not chosen. These numbers are LINEAR and they are read through
  // ACES and then an sRGB encode, and that pair lifts the bottom of the range
  // enormously: 0.125 of linear blue — which sounds like almost nothing —
  // comes out at 0.50 on screen, and phase 1 photographed as a solid mid-blue
  // PLASTIC BALL with a white fingernail stuck on the bottom of it. These are
  // the values that land on the near-black navy the card art has.
  const vec3 ASH = vec3(0.013, 0.023, 0.040);

  void main() {
    vec3 N = normalize(vN);
    vec3 E = normalize(vE);
    float ndl = dot(N, vL);
    float nde = max(dot(N, E), 0.0);
    // The terminator. A real one is soft over about a degree, which on a
    // fifty-pixel disc is a tenth of a pixel — so it is widened to a couple of
    // pixels' worth, purely so it does not alias into a staircase.
    float day = smoothstep(-0.045, 0.085, ndl);
    // LOMMEL-SEELIGER, which is the photometric function the actual moon
    // follows, and it is one line. Lambert was wrong in the obvious direction
    // — a full moon came out a shaded BEAD, and the real one is a flat disc —
    // but the cheap fix for that, raising N·L to a low power, was wrong in the
    // other: it held full brightness right up to the terminator, so the
    // half-moon photographed as a grey cap butted against a navy one with a
    // ruled line between them. This does both at once, because it is what the
    // surface does: at full moon N·L and N·V are equal everywhere and it goes
    // perfectly flat, and away from full it falls away into the terminator on
    // its own. The 1.75 restores the brightness the halved ratio costs, and
    // the ceiling is there because the sunward limb, where N·V goes to zero,
    // runs away otherwise.
    float ls = ndl > 0.0 ? ndl / max(ndl + nde, 0.02) : 0.0;
    float lit = min(1.75 * ls, 1.15) * day;

    vec3 rock = mix(MARE, HIGH, vShade);
    vec3 col = rock * lit;
    // Earthshine, strongest in the middle of the disc and dying at the limb.
    // ^1.7 and not ^0.8: flatter than this the unlit side was an even navy
    // CAP with a hard rim, which is a painted shape however dark it is, and
    // the one thing that has to survive here is that this is a ball.
    float ash = pow(nde, 1.7);
    col += ASH * uEarth * ash * (1.0 - day * 0.85);

    gl_FragColor = vec4(col, uOpacity);
    // Through the same curve as the rest of the table. A ShaderMaterial gets
    // neither of these unless it asks, and without them the moon is the one
    // object on screen not tone mapped — which is its own way of looking like
    // it came from a different program.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// 3 degrees of arc a cell at the equator, which at the size this is drawn is
// about a pixel: finer buys nothing and coarser shows the terminator as a
// staircase, because the terminator is a line of VERTICES here, not a painted
// curve.
const SEG_U = 120, SEG_V = 80;

const dot3 = (a, b, c, d, e, f) => a * d + b * e + c * f;

/** Deterministic, so every moon in every game has the same face. */
function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// The big light/dark divide: maria against highlands. Low frequency on purpose
// — three or four broad dark seas is what a moon looks like at a glance, and a
// fine mottle all over reads as noise or as dirt on the lens.
function seas(x, y, z) {
  return 0.55 * Math.sin(1.7 * x + 0.9 * y - 1.2 * z + 0.4)
    + 0.30 * Math.sin(-2.6 * x + 3.1 * y + 1.4 * z - 1.9)
    + 0.15 * Math.sin(4.3 * x - 1.1 * y + 5.0 * z + 2.7);
}

// The fine relief under the craters, so the surface is never a smooth ball
// between them — and so the LIMB is not a perfect circle, which is the one
// thing a drawn moon always is.
function relief(x, y, z) {
  return 0.50 * Math.sin(6.1 * x + 4.2 * y - 3.3 * z) * Math.sin(5.4 * y + 2.2 * z)
    + 0.30 * Math.sin(11.3 * x - 7.9 * z + 1.1) * Math.sin(9.7 * y - 4.4 * x)
    + 0.20 * Math.sin(19.1 * z + 13.3 * y) * Math.sin(17.7 * x + 2.2);
}

/**
 * THE CRATERS ARE GEOMETRY. A painted crater gives itself away the moment the
 * terminator sweeps past it: its shading does not change, because it has no
 * shape to catch the light with. These are real bowls with real raised rims
 * cut into the sphere, so a crater near the terminator fills with shadow on
 * its sunward wall and lights on its far one, and the same crater at full moon
 * nearly vanishes — which is exactly what happens to the real thing.
 *
 * Angular radii, not world radii: a crater is a cap on a sphere.
 */
function craters() {
  const rnd = rand(20460126);
  const out = [];
  // SEVENTY, not the twenty-six this started with. The count is not about
  // texture, it is about the TERMINATOR: with twenty-six craters only a
  // couple ever lie on the line, so the half moon came back with a razor
  // straight edge ruled across it — every photograph of it read as two
  // painted caps however right the shading either side of the line was. At
  // seventy the terminator always crosses six or eight of them and it is
  // chewed, which is the whole reason the craters are geometry.
  for (let i = 0; i < 70; i++) {
    // Uniform on the sphere. Picking a lat/long pair instead crowds every
    // crater around the poles, which on a body this small is obvious.
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    // A few big ones and a lot of small ones, which is the size distribution
    // an impact history leaves. All the same size is a golf ball.
    const big = i < 6;
    out.push({
      x: s * Math.cos(a), y: u, z: s * Math.sin(a),
      ra: big ? 0.20 + rnd() * 0.12 : 0.045 + rnd() * 0.085,
      // Depth in radii, and DEEPER than a real moon's craters are. Cut to
      // scale they left the half-moon terminator as a clean straight line
      // across the ball — two painted halves, which is the thing this whole
      // rebuild is against. A terminator is ragged because it is falling
      // across real relief, so the relief is exaggerated until it bites into
      // it. It costs nothing at full moon, where shadows vanish anyway.
      d: (big ? 0.034 : 0.019) * (0.6 + rnd() * 0.7),
    });
  }
  return out;
}

/**
 * The body: a unit sphere with the surface cut into it, plus a per-vertex
 * albedo the shader mixes the rock colour from.
 *
 * Built per cast and disposed per cast. It could be cached at module scope,
 * but that is exactly the trap a Sprite's shared geometry set — `kit.hold`
 * disposes every geometry it traverses, and one module-level buffer shared by
 * two casts is one dispose away from an invisible moon. Nine thousand vertices
 * of arithmetic is a couple of milliseconds, four times a game.
 */
function moonGeometry() {
  const geo = new THREE.SphereGeometry(1, SEG_U, SEG_V);
  const pos = geo.attributes.position.array;
  const n = pos.length / 3;
  const shade = new Float32Array(n);
  const PITS = craters();

  for (let i = 0; i < n; i++) {
    const k = i * 3;
    const x = pos[k], y = pos[k + 1], z = pos[k + 2];
    // 0.013, doubled from 0.0065, for the same reason the crater count went
    // up: this is the roughness BETWEEN the craters, and it is what stops the
    // stretches of terminator that miss a crater from going straight again.
    const rlf = relief(x, y, z);
    let h = 0.013 * rlf;
    let floor = 0, rim = 0, ray = 0;
    for (const p of PITS) {
      const c = dot3(x, y, z, p.x, p.y, p.z);
      if (c <= 0) continue;                       // the far side of the ball
      const ang = Math.acos(Math.min(1, c));
      const t = ang / p.ra;
      // EJECTA. Only the big ones throw it, and it is albedo rather than
      // shape: a full moon has no shadows in it at all — the sun is directly
      // behind the viewer, so every crater flattens out — and without the pale
      // ray systems the fourth phase photographed as a plain white ball. The
      // rays are what a full moon actually looks like.
      if (p.big && t > 0.9 && t < 3.4) {
        ray = Math.max(ray, (1 - (t - 0.9) / 2.5) * (0.35 + 0.65 * Math.abs(rlf)));
      }
      if (t > 1.3) continue;
      // A flat-ish floor out to two thirds, the wall, then a rim standing
      // proud of the plain. Built as floor + rim rather than as one bell: a
      // single bell is a DIMPLE, and a dimple has no shadow-catching wall.
      const bowl = -p.d * (1 - smooth((t - 0.35) / 0.65));
      const lip = 0.45 * p.d * Math.exp(-((t - 0.98) ** 2) / 0.022);
      h += bowl + lip;
      floor = Math.max(floor, -bowl / p.d);
      rim = Math.max(rim, lip / p.d);
    }
    const r = 1 + h;
    pos[k] = x * r; pos[k + 1] = y * r; pos[k + 2] = z * r;

    // Highlands by default, maria where the low-frequency field dips, crater
    // floors a shade darker and fresh rims a shade brighter. The albedo does
    // the reading at play scale; the geometry does it when the camera leans in.
    // The maria run WIDE and dark. At a threshold of 0.10 and a width of 0.55
    // only a fifteenth of the ball ever reached full mare, so the full moon
    // came back an even white pellet — at full phase the shading is flat by
    // definition and the albedo is the only thing left drawing.
    const sea = smooth((seas(x, y, z) + 0.05) / 0.45);
    shade[i] = clamp01(1 - sea * 0.86 - floor * 0.22 + rim * 0.35 + ray * 0.30);
  }
  geo.setAttribute('aShade', new THREE.BufferAttribute(shade, 1));
  geo.computeVertexNormals();

  // AVERAGE THE NORMALS ACROSS THE SEAM AND THE POLES. SphereGeometry
  // duplicates vertices where the texture seam closes and once per column at
  // each pole; `computeVertexNormals` never sees those as the same point, so
  // the displaced moon came out with a hard bright CREASE running pole to pole
  // and a pinched star at the top — a straight line down a moon is the loudest
  // possible tell. Keyed on the position, which the duplicates share exactly.
  const nor = geo.attributes.normal.array;
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    const key = `${pos[k].toFixed(5)},${pos[k + 1].toFixed(5)},${pos[k + 2].toFixed(5)}`;
    const at = seen.get(key);
    if (at === undefined) seen.set(key, i);
    else { nor[at * 3] += nor[k]; nor[at * 3 + 1] += nor[k + 1]; nor[at * 3 + 2] += nor[k + 2]; }
  }
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    const key = `${pos[k].toFixed(5)},${pos[k + 1].toFixed(5)},${pos[k + 2].toFixed(5)}`;
    const at = seen.get(key) * 3;
    const l = Math.hypot(nor[at], nor[at + 1], nor[at + 2]) || 1;
    nor[k] = nor[at] / l; nor[k + 1] = nor[at + 1] / l; nor[k + 2] = nor[at + 2] / l;
  }
  return geo;
}

/**
 * THE MOON ITSELF, and it lights itself.
 *
 * No light is added to the scene to do this. The arena is dark and the key
 * light is a spotlight confined to the board, so a moon standing out here off
 * the flagstones would get almost nothing from it — and a lamp big enough to
 * reach would leak over the board and the ruins, which is somebody else's
 * picture. The material computes its own N·L against a sun direction it builds
 * from two angles, and nothing else in the scene can see it.
 *
 * `phase(f, roll)` is the whole interface: `f` is the LIT FRACTION, 0 for new
 * and 1 for full, and it is turned into the sun's phase angle by the actual
 * relation between them — f = (1 + cos θ)/2, so θ = acos(2f - 1) — so the
 * terminator lands where
 * the geometry says it lands at every value, with no special case at a half
 * and no ring artefact, which is what the painted version needed a mask to
 * avoid. `roll` swings the horns about the line of sight, which is what the
 * card's "rotate this card" is spent on.
 *
 * The BODY does not turn with the roll, and that is deliberate: the moon keeps
 * one face to us, so the craters stay put and the terminator sweeps ACROSS
 * them. Watching a crater's shadow grow as the light leaves it is the single
 * strongest thing in here, and it is only possible because the craters are
 * shape rather than paint.
 */
export function makeMoon() {
  const geo = moonGeometry();
  const uniforms = {
    uTheta: { value: Math.PI }, uRoll: { value: 0 },
    uOpacity: { value: 1 }, uEarth: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: MOON_VERT, fragmentShader: MOON_FRAG,
    // FrontSide and no depth write. The sphere is convex, so its front faces
    // never overlap on screen and the transparent pass cannot sort them wrong;
    // DoubleSide would draw the inside of the far hemisphere through the near
    // one, which is a moon with its own back showing through it.
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // A little off vertical, the way the real one is, so the crater field is not
  // laid out symmetrically about the horns.
  mesh.rotation.set(0.22, -0.55, 0.14);
  return {
    mesh,
    phase(f, roll) {
      // acos(2f - 1), and the sign of it matters: written the other way round
      // a full moon asked for a phase angle of pi, which is a NEW one, and
      // every phase came out as a dark ball with nothing but earthshine on it.
      uniforms.uTheta.value = Math.acos(Math.max(-1, Math.min(1, 2 * f - 1)));
      uniforms.uRoll.value = roll;
    },
    opacity(a) { uniforms.uOpacity.value = a; },
    earth(e) { uniforms.uEarth.value = e; },
    /** Scale takes a DIAMETER, because the sprite it replaced was sized by one
     *  and every number tuned against this camera is in those units. */
    size(d) { mesh.scale.setScalar(d * 0.5); },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

/** Where the moon waits: mirrored across the Stronghold from the discard pile,
 *  which is the only other thing standing beside it. */
export function besidePosition(player) {
  const p = strongholdPosition(player).clone();
  // Mirrored across the Stronghold from the discard pile, but a card's width
  // further out and half a square further back than the pile is. At the
  // graveyard's own offset the moon — which hangs a world unit and a half in
  // the air, and so is drawn a good forty pixels UP the screen from where it
  // stands — landed squarely on the card in the near-left square and read as a
  // hole punched through it. Out here it has open dirt behind it.
  p.x = (player === 0 ? -1 : 1) * (CARD_W + 1.35);
  p.z += (player === 0 ? 1 : -1) * 1.2;
  return p;
}

/**
 * WHICH TURN THIS IS.
 *
 * The dispatcher hands every table motif (kit, at, faction), so the rules'
 * {player, phase} arrives with the player in `at` and the phase nowhere at
 * all — and the phase is the entire content of this effect. So it is counted
 * here, per player, and wraps after the fourth: a moon that has turned over is
 * gone, and a second game on the same page starts from a clean crescent.
 *
 * An `at` that is an OBJECT is believed outright — that is how the harness
 * shoots phase 3 without playing two turns first, and how this picks up a
 * phase from the rules the day the dispatcher can carry one.
 */
const TURNED = [0, 0];
function readPhase(at) {
  if (at && typeof at === 'object') {
    const p = Math.round(at.phase ?? 1);
    const who = at.player === 1 ? 1 : 0;
    TURNED[who] = Math.max(0, Math.min(4, p));
    return { player: who, phase: TURNED[who] };
  }
  const player = at === 1 ? 1 : 0;
  TURNED[player] = (TURNED[player] % 4) + 1;
  return { player, phase: TURNED[player] };
}

export function moonphase(kit, at) {
  const { player, phase } = readPhase(at);
  const home = besidePosition(player);
  const span = SPAN[phase];
  const gain = GAIN[phase];

  // The lane points at the middle of the player's own back row. Local +u is
  // that direction: for a group yawed by `a`, local +x lands on
  // (cos a, 0, -sin a), so the yaw is atan2(-dz, dx) and nothing else in here
  // has to know which end of the table it is at.
  const target = new THREE.Vector3(0, 0, (player === 0 ? 1 : -1) * 2.62);
  const dx = target.x - home.x, dz = target.z - home.z;
  const g = new THREE.Group();
  // 0.145 and not the dirt's own height: the lane crosses onto the flagstones,
  // whose faces are at 0.080, and at 0.04 the far half of it was swallowed by
  // the stone it was supposed to be lying on — the light simply stopped at the
  // edge of the board, which is the opposite of the thing being said. 0.095
  // was the fix for that and it was not enough: fifteen millimetres is under
  // this camera's depth resolution, so the far end of the lane was still being
  // eaten and only the part over the dirt apron ever drew. 65mm of clearance
  // over the stone, and 1.7 pixels of lift on screen, which nobody can see.
  // Still well under a card face at ~0.21, so the light runs UNDER the
  // fighters it is reaching for, which is where moonlight on the ground goes.
  g.position.set(home.x, 0.145, home.z);
  g.rotation.y = Math.atan2(-dz, dx);

  /* ---- the water: one sheet holding both the pool and the lane ---- */

  const U = new Float32Array(NU), V = new Float32Array(NV);
  for (let i = 0; i < NU; i++) U[i] = -BACK + ((LEN + BACK) * i) / (NU - 1);
  for (let j = 0; j < NV; j++) V[j] = -HV + (2 * HV * j) / (NV - 1);

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NU * NV * 3);
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const n = (i * NV + j) * 3;
      pos[n] = U[i]; pos[n + 2] = V[j];
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

  // Unlit, like every other water sheet in this faction: the key light is a
  // warm low sun and anything cool standing under it goes grey-green. All of
  // the colour below is placed by hand in the vertex attribute.
  const sheet = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  sheet.renderOrder = 1;
  g.add(sheet);

  /* ---- the moon ---- */

  // A real sphere, self-lit — see `makeMoon` above for why it is not a
  // billboard any more and why no light is added to the scene for it.
  const moon = makeMoon();
  moon.mesh.position.set(home.x, 2.50, home.z);
  moon.size(MOON[phase]);
  moon.phase(LIT[phase - 1], 0);
  // AFTER the halo, which is the one reason the full moon had a face at all.
  // Both sit at the same point, so the transparent pass sorted them by whim,
  // and when the halo won it added a fifth of white to every pixel of the
  // moon's disc — the ACES curve took the rest, and phase 4 came back as a
  // blank pearl with no craters, no limb and no gradient in it. Drawn last,
  // the moon's own body covers the halo and the glow is only ever seen AROUND
  // it, which is what a glow is. renderOrder does not touch depthTest, so
  // nothing standing in front of it stops occluding it.
  moon.mesh.renderOrder = 3;
  kit.scene.add(moon.mesh);      // its own object: the sheet's group is yawed

  // One halo, NOT additive-stacked. Two of them summed past 1.0 in all three
  // channels under the ACES curve and the moon came back as a white pellet
  // with no crescent in it; one, kept under half opacity, is a glow.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blobTexture('rgba(226,240,220,0.9)', 'rgba(150,190,200,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  halo.renderOrder = 2;
  halo.position.copy(moon.mesh.position);
  kit.scene.add(halo);

  /* ---- fixed per-column and per-row shapes ---- */

  // The pool's rim wanders. At a true circle it read as a painted UI disc
  // beside the Stronghold, which is exactly what this must not be.
  const RIM = new Float32Array(64);
  for (let k = 0; k < RIM.length; k++) {
    const a = (k / RIM.length) * Math.PI * 2;
    RIM[k] = 1 + 0.09 * Math.sin(a * 3 + 0.6) + 0.06 * Math.sin(a * 5 - 1.4)
      + 0.035 * Math.sin(a * 9 + 2.2);
  }
  const rimAt = (a) => {
    const x = ((a / (Math.PI * 2)) % 1 + 1) % 1 * RIM.length;
    const i = x | 0;
    return RIM[i] + (RIM[(i + 1) % RIM.length] - RIM[i]) * (x - i);
  };

  // The lane's own edges, broken along its length for the same reason.
  const LW = new Float32Array(NU);
  for (let i = 0; i < NU; i++) {
    const u = U[i];
    LW[i] = 0.34 + 0.075 * u + 0.08 * Math.sin(u * 2.3 + 0.9) + 0.05 * Math.sin(u * 5.1 - 2.1);
  }

  const cPos = geo.attributes.position.array;
  const cCol = geo.attributes.color.array;
  const c = new THREE.Color();

  kit.hold(g, span, (t) => {
    // The whole thing fades up and away; the moon is the last thing to go.
    const env = smooth(t / 0.13) * (1 - smooth((t - 0.74) / 0.26));
    // The pool spreads and then relaxes a little, so the water is never simply
    // switched on at its final size.
    const grow = smooth(t / 0.4);
    const pr = POOL[phase] * (0.55 + 0.45 * grow) * (1 + 0.04 * Math.sin(t * 9));
    // The lane only unrolls once the pool has something in it, and it slows as
    // it goes: linear travel over five units is a wipe.
    const reach = REACH[phase] * clamp01((t - 0.16) / 0.5) ** 0.7;
    // Phase 4's swell, which is the one moment any of this actually leaves the
    // pool. It sets off late and is still running when the motif ends —
    // deliberately unfinished, because the turn after this one it does not
    // come back, it arrives.
    const surge = SURGE[phase] ? clamp01((t - 0.28) / 0.66) : 0;
    const front = -0.4 + (REACH[phase] + 0.9) * surge ** 0.8;
    // How much of the moon is lit RIGHT NOW. Computed here and not down with
    // the moon, because the reflection in the pool is the same moon and has to
    // wax with it — a full moon over a pool with a crescent in it is the sort
    // of thing that reads as wrong before it reads as anything.
    const turn = smooth(clamp01((t - 0.06) / 0.62));
    const want = LIT[phase - 1] + (LIT[phase] - LIT[phase - 1]) * turn;

    for (let i = 0; i < NU; i++) {
      const u = U[i];
      const lw = LW[i];
      for (let j = 0; j < NV; j++) {
        const v = V[j];
        const n = (i * NV + j) * 3;
        const n4 = (i * NV + j) * 4;
        const r = Math.hypot(u, v);

        // The pool, and the lane running out of it. `cover` is one field so
        // the two are the same body of water — drawn as two meshes they read
        // as a disc with a bar stuck on it.
        const edge = rimAt(Math.atan2(v, u)) * pr;
        const pool = smooth((edge - r) / 0.19);
        const lane = u > -0.2 && reach > 0
          ? smooth((lw - Math.abs(v)) / 0.34) * smooth((reach - u) / 1.1)
            * smooth((u + 0.2) / 0.5)
          : 0;
        const cover = Math.max(pool, lane);
        if (cover <= 0.002) {
          cPos[n + 1] = 0;
          cCol[n4 + 3] = 0;
          continue;
        }

        // The heave. Slow rings leaving the moon's own reflection, plus one
        // long cross wave so the surface is never a plane. Small — this pool
        // is 1.3 across and a crest of any size in it is a sculpture.
        const heave = 0.035 * Math.sin(r * 5.4 - t * 7.2) * smooth(r / 0.3)
          + 0.022 * Math.sin(v * 3.1 + u * 1.7 - t * 3.4);
        // The swell running the lane, with a toe so it is zero deep where it
        // meets dry dirt — a crest whose foot is nowhere hovers over the ground
        // rather than running across it.
        const d = u - front;
        const toe = d >= 0 ? 0 : smooth(-d / 0.24);
        const sw = surge
          ? toe * Math.exp(-((d + 0.26) ** 2) / 0.075) * lane * (0.4 + 0.6 * surge)
          : 0;
        cPos[n + 1] = (heave * cover + 0.30 * sw) * env;

        // Deep water, near-black, going to mid only where the surface tips up.
        const up = clamp01(heave * 9 + sw * 2.2);
        c.copy(DEEP).lerp(MID, up ** 1.6 * 0.7);

        // THE REFLECTION. The moon's own image lying in the pool under it,
        // torn across by two ripples. The pool is fifty pixels wide on screen
        // and only ONE bright shape fits in it — the eye needs one thing to
        // recognise, at the one place it already knows to look. Spread wider
        // than this it is not a reflection, it is a grey wash, which is
        // exactly what the first two passes produced.
        // Torn into three or four bars with real dark between them: a single
        // soft gaussian is a THUMBPRINT OF WHITE PAINT, which is what the last
        // pass put in the pool. Water breaks an image, it does not smudge it.
        //
        // Tied to the LIT FRACTION and not to a floor of 0.3: a new moon casts
        // no reflection, and at a floor the pool under a fingernail of light
        // held nearly half the image a full moon does — so phase 1 and phase 4
        // glittered the same amount, and the escalation this whole card is
        // counting toward was not on screen at all.
        const refl = Math.exp(-((u - 0.10) ** 2) / 0.085 - (v * v) / 0.040)
          * Math.max(0, Math.sin(u * 13.5 - t * 4.4 + v * 2.2)) ** 2
          * pool * (0.06 + 0.94 * want);

        // THE GLADE — the light broken on the water on its way to the board,
        // as a scatter of SEPARATE dashes lying across the lane.
        //
        // Three times wrong now. Contours of three waves at eleven to
        // twenty-one cycles a unit came back as a black rag with white
        // confetti torn out of it: at forty pixels a world unit those specks
        // are two pixels, which the eye reads as noise and not as light. Then
        // soft facets a third of a unit wide, at half opacity over the whole
        // pool, came back as a bank of GREY SMOKE — medium brightness spread
        // over an area is a wash whatever colour it is.
        //
        // The third was a COMB, and it is what this pass is here to fix: one
        // crest wave running along the lane with nothing cutting it, clipped
        // at full white, so every glint was a BAR spanning the whole width of
        // the lane — five of them, evenly spaced, all the same brightness,
        // with square ends. Photographed at the real camera those bars read as
        // strips of TORN PAPER lying on black, and no amount of retuning the
        // spacing touched it, because spacing was not what was wrong. A glint
        // has three things a bar has not got: an END, a NEIGHBOUR dimmer than
        // itself, and a SOFT EDGE. All three are built below.
        const wobble = 0.7 * Math.sin(v * 1.9 + u * 0.4) + 0.3 * Math.sin(v * 4.7 - 1.1);
        // The crest that catches the moon. 8.2 radians a unit is a crest every
        // 0.77, about a third of a card, which puts five or six of them along
        // the run. At 2.3 — the number that looked right written down — the
        // wavelength was 2.7 units and the whole lane held ONE AND A HALF, so
        // there was nothing marching anywhere.
        const crest = Math.max(0, Math.sin(u * 8.2 - t * 4.2 + wobble));
        // THE END. A second wave cuts along the crest, so each one arrives as
        // one or two dashes a fifth of a card long with dark water between
        // them instead of a bar the full width of the lane. It drifts along
        // the lane as well as across it (the u term), so neighbouring crests
        // break in different places — cut by v alone, every crest broke at the
        // same two points and the lane came back as a ladder.
        // An ENVELOPE, not a second sine, and this one was measured rather
        // than guessed. Cutting the crest with sin(v*k) meant the dash was
        // wherever that sine happened to peak, and for most of the lane that
        // was out at the lane's own soft edge where nothing survives: a dump
        // of the vertex buffer along the lane showed alpha 0.12 — the lane's
        // bare body and no glint at all — over its whole length at phase 3,
        // and the same reading is why the last two passes looked dead at the
        // table camera and alive in the close-up harness. Three sines
        // multiplied together only fire where all three peak, which over a
        // lane half a unit wide is almost nowhere. A gaussian centred on a
        // wandering point lights EVERY crest, at a width set in world units.
        // 0.028 is a half-width of 0.16, fourteen pixels here.
        const centre = 0.30 * Math.sin(u * 2.7 + t * 1.1);
        const cut = Math.exp(-((v - centre) ** 2) / 0.028);
        // THE NEIGHBOUR. A slow wave along the lane decides which crests are
        // lit brightly; a glade is a few bright dashes with dimmer ones
        // between them, and six identical ones in a row is a dashed line,
        // which is a UI element. A function of u ALONE, so it dims a whole
        // crest rather than punching a hole in the middle of one.
        const pick = 0.45 + 0.55 * Math.max(0, Math.sin(u * 2.3 - t * 1.9 + 0.7));
        // THE SOFT EDGE: a small near-white core inside a much dimmer wash of
        // the same shape. One hard clip has nowhere to fall off to and ends in
        // a cut edge; the core carries the light and the wash gives it a rim
        // of dim water to end in. The exponents are chosen by the SIZE ON
        // SCREEN they leave, not by eye: ^3 of a crest at 8.2 radians a unit
        // holds its value over 0.2 units, which is nine pixels here, and the
        // ^7 this started at held it over four — a sub-pixel detail is an
        // absent one and those glints vanished at the real camera.
        const core = crest ** 3 * cut * pick;
        const soft = crest ** 1.2 * Math.exp(-((v - centre) ** 2) / 0.09) * pick * 0.22;
        // Thinning out along the lane, which is what a moonglade does — and it
        // is also the only cue that says which end the light is coming FROM.
        // It never reaches zero: at a plain exponential the far half of the
        // lane was dark water on dark dirt, which is not a path of light, it
        // is nothing at all.
        const near = 0.34 + 0.66 * Math.exp(-Math.max(0, u) / 2.8);
        // Flat across most of the lane and falling off only at its edges. Tied
        // to the full width instead, every dash tapered to a point at both
        // ends and they came back as a row of soft white COTTON BALLS — round
        // is the one shape a glint off water is not.
        const band = smooth((lw - Math.abs(v)) / (lw * 0.38));
        // Weighted to the LANE. In the pool the moon's own reflection is the
        // one thing to look at, and the same dashes laid over it were a second
        // texture fighting the first — and, since the glade was never tied to
        // the moon, they were the brightest thing in phase 1, where the moon
        // is a fingernail and there is no lane for them to be lying in.
        const glade = (core * 3.2 + soft) * (lane + pool * 0.22) * near * band * want;
        // The core outweighs the wash fifteen to one and is allowed to clip.
        // Split evenly they averaged out to one dim brightness over the whole
        // lane, which is the grey wash this file has been fighting since the
        // start: what reads as light is a PEAK — a few pixels at the top of
        // the scale — with everything around it well below. 3.2 was read off
        // the vertex buffer, not guessed: at 2.0 the brightest dash on the
        // lane came out at a third of the scale, a mid-grey smudge.
        const glit = Math.min(0.85, (refl * 0.95 + glade * 1.15) * (0.4 + 0.6 * gain));
        c.lerp(GLINT, glit);

        // The dark ring the pool sits in — wet dirt, no light in it. Contrast
        // here is bought with shadow first: a pale lane on lit ground is a
        // smear, and the same lane with a dark collar around it is light. Kept
        // TIGHT: at half a unit of falloff either side it was a lumpy grey
        // cloud lying on the dirt, bigger than the pool it was meant to frame.
        const socket = smooth((r - edge * 0.90) / 0.26) * smooth((edge + 0.30 - r) / 0.26);
        c.lerp(SOCKET, Math.min(1, socket * 0.7 * (1 - glit)));

        // The waterline: one thin pale edge where the pool meets dry dirt. It
        // is the only hard line in the picture, and without it the pool had no
        // edge to be the inside of — a soft dark patch on dark dirt is a
        // smudge, whatever is glittering in the middle of it. Broken along its
        // length, because an unbroken ring is a drawn circle.
        // 0.05 was a sigma of two pixels at this camera, and a sub-pixel
        // detail is an absent one: the pool had no waterline on screen at any
        // phase. 0.085, and carrying its own weight in the alpha below.
        const line = Math.exp(-(((r - edge) / 0.085) ** 2))
          * clamp01(0.25 + 0.9 * Math.sin(r * 9 + Math.atan2(v, u) * 6.3)) * smooth(pr / 0.6);
        // Foam, only on the phase-4 swell, and only where it is breaking.
        const foam = sw > 0 ? smooth((sw / 0.42 - 0.55) / 0.3) * (0.6 + 0.4 * Math.sin(v * 17)) : 0;
        c.lerp(FOAM, Math.min(1, foam + line * 0.7));

        cCol[n4] = c.r; cCol[n4 + 1] = c.g; cCol[n4 + 2] = c.b;
        // THE POOL IS A BODY OF WATER; THE LANE IS A PATH OF LIGHT. They are
        // one mesh but they cannot carry the same alpha: the pool is near-black
        // and wants to be solid, and the first cut gave the lane the same
        // weight — which drew a dark strip of near-black water across dark dirt
        // and then put faint glints on it, so the whole reach of the motif, the
        // one thing the four firings are counting toward, was invisible on
        // screen. The lane's own body is barely there now and its GLINTS carry
        // it.
        //
        // And the body thins as it goes, which it has to once the lane reaches
        // the FLAGSTONES. Over the dirt apron a flat 0.12 of near-black is
        // water; over pale lit stone the same film is a grey smear lying on
        // the board, and it dimmed the gate marking it crossed. Past the
        // apron there is no body left at all and only the dashes arrive, which
        // is also the truer picture: moonlight reaches further than the pool
        // that throws it.
        const thin = 0.25 + 0.75 * Math.exp(-Math.max(0, u) / 2.0);
        cCol[n4 + 3] = Math.min(1, env * (pool * (0.44 + 0.22 * gain) + lane * 0.12 * thin
          + glit * 0.9 + socket * 0.5 + foam * 0.8 + line * 0.55));
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    /* ---- the moon, turning and waxing ---- */

    // The quarter turn, with a little overshoot and a settle: a rotation that
    // simply eases to a stop is a slider moving, and this is a thing with
    // weight being turned on a plinth.
    const wob = Math.sin(clamp01((t - 0.55) / 0.45) * Math.PI) * 0.055 * (1 - turn * 0.4);
    const roll = -((phase - 1) + turn) * Math.PI * 0.5 + wob;
    // The lit fraction and the roll, and the terminator falls out of the two.
    // Both are handed over every tick and neither costs anything: the phase is
    // two floats in a uniform now, where the painted moon was a 192-square
    // canvas that had to be thrown away and re-uploaded whenever the crescent
    // moved far enough to be worth it.
    moon.phase(want, roll);
    // It rises a little as it turns — a hand's width, which at 26 pixels a
    // unit is four pixels and is felt rather than seen.
    // 2.50 and not the 1.5 it started at. Height costs about 26 screen pixels
    // a world unit here, so at 1.5 the moon was drawn only THIRTY pixels above
    // its own pool — a sixty-pixel disc with its bottom half lying in its own
    // reflection, which is not a moon over water, it is a coin in a puddle.
    moon.mesh.position.y = 2.50 + 0.16 * smooth(t) + 0.05 * Math.sin(t * 5.5);
    const size = MOON[phase - 1] + (MOON[phase] - MOON[phase - 1]) * turn;
    moon.size(size);
    const alpha = smooth(t / 0.1) * (1 - smooth((t - 0.8) / 0.2));
    moon.opacity(alpha);
    // EARTHSHINE FALLS AS THE MOON WAXES, which is the real relation and not a
    // flourish: it is light off the EARTH, and the earth is full when the moon
    // is new. Held flat it made phase 3 a navy semicircle butted against a
    // grey one — a two-tone painted ball, which is exactly the look this is
    // replacing. Thin phases keep it, and they need it: at a fingernail of
    // light the faint ball behind the horns is the only body the moon has.
    // ^3, not ^1.6. At a half moon the real thing's dark side is BLACK — the
    // earth is half lit too, and what little it throws is invisible beside a
    // half moon — and the navy cap this was still drawing there was the last
    // thing making the ball read as two painted halves.
    moon.earth(0.06 + 1.50 * (1 - want) ** 3);

    halo.position.copy(moon.mesh.position);
    halo.scale.setScalar(size * (2.4 + 0.8 * want));
    // Tied to the LIT AREA and not to the phase: a thin crescent that threw
    // the same glow as a full moon was the clearest thing in the first four
    // frames and it said nothing at all.
    halo.material.opacity = alpha * (0.06 + 0.20 * want) * gain;
  }, () => {
    kit.scene.remove(moon.mesh); kit.scene.remove(halo);
    // The moon owns its own geometry and takes it down itself. The old sprite
    // could not: a Sprite's geometry is a MODULE-LEVEL singleton in three.js,
    // shared by every sprite in the scene, and disposing it here took the
    // torch glows and the deploy burst down with it the first time. The halo
    // is still a sprite, so that hazard still applies to IT — materials and
    // maps only below.
    moon.dispose();
    halo.material.map.dispose(); halo.material.dispose();
  });

  // Cold light on the dirt. Off the board on purpose — it reaches the stone
  // only at phase 4, and the reach is the point. Low power: a bright cool lamp
  // over Marvorren's own blue-green art kills every edge in it, which is the
  // lesson ./cast-marvorren.js paid for.
  kit.light(new THREE.Vector3(home.x, 0.9, home.z), 0xa9d4e8, {
    power: 0.9 + 2.6 * gain * gain, seconds: span * 0.8, reach: 2.6 + 2.4 * gain,
  });

  // Spray, and only once there is enough water to throw any. Pale, not teal:
  // this is light off the water, and it has to belong to the moon.
  if (phase >= 3) {
    kit.after(0.3, () => kit.sparks(new THREE.Vector3(home.x, 0.16, home.z), {
      colour: 'rgba(222,240,232,1)', count: phase === 4 ? 13 : 6,
      spread: 0.5 + 0.25 * phase, seconds: 0.5, rise: 0.5, size: 0.17,
    }));
  }
}
