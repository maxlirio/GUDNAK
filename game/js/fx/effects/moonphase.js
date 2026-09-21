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

/**
 * The moon, painted.
 *
 * The lit part is built as a MASK and then cut to the disc, rather than by
 * subtracting an ellipse from a circle. Subtracting leaves a ring — the first
 * attempt produced a moon with a hole in it at every phase past a half — where
 * the union of a half-plane and the terminator ellipse is the shadow exactly,
 * for any lit fraction, with no special case at 0.5.
 *
 * The DARK DISC matters as much as the lit part. A bare crescent floating on
 * the night is a comma; the card art shows the whole sphere, the unlit side a
 * shade above the sky, and without it phases 1 and 2 were unreadable — a
 * scratch of light with no body behind it, which at 40 pixels is a spark.
 */
export function moonTexture(f) {
  const S = 192, cx = S / 2, cy = S / 2, R = S * 0.44;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');

  // the unlit sphere: a hair above the night, with its own soft edge
  g.fillStyle = '#101b30';
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();

  // THE LIT SIDE, built on its own canvas so everything that follows — the
  // gradient, the craters, the limb rim — can be clipped to it with
  // `source-atop` and cannot leak onto the dark half. Painted straight onto
  // the moon, the rim ran the whole way round and the crescent came back as a
  // dark bowl with a white hoop on it.
  const m = document.createElement('canvas');
  m.width = S; m.height = S;
  const mg = m.getContext('2d');
  mg.fillStyle = '#fff';
  mg.fillRect(cx, 0, S - cx, S);                       // the sunward limb
  // The shadow is the UNION of the far half-plane and the terminator ellipse,
  // which is exact at every lit fraction. Cutting an ellipse out of a full
  // disc instead leaves a RING — a moon with a hole in it at every phase past
  // a half, which is what the first pass did.
  const semi = Math.abs(1 - 2 * f) * R;
  mg.globalCompositeOperation = f < 0.5 ? 'destination-out' : 'source-over';
  mg.beginPath(); mg.ellipse(cx, cy, semi, R, 0, 0, Math.PI * 2); mg.fill();
  mg.globalCompositeOperation = 'destination-in';
  mg.beginPath(); mg.arc(cx, cy, R, 0, Math.PI * 2); mg.fill();

  // The lit surface. Deliberately DIM — a moon painted at the cream the card
  // art shows came out of the ACES curve as a blank white pellet with no
  // crescent, no craters and no rim in it. The tone mapping lifts this back to
  // cream; paint it at cream and there is nowhere left to lift to.
  mg.globalCompositeOperation = 'source-in';
  const grad = mg.createLinearGradient(cx - R, 0, cx + R, 0);
  grad.addColorStop(0, '#9aa177');
  grad.addColorStop(0.55, '#c3c596');
  grad.addColorStop(1, '#a8c4cf');
  mg.fillStyle = grad;
  mg.fillRect(0, 0, S, S);

  // Craters, and limb darkening under them. Without any mottle the moon is a
  // sticker; without the darker edge it is a flat coin rather than a ball.
  mg.globalCompositeOperation = 'source-atop';
  mg.fillStyle = 'rgba(40,48,36,0.24)';
  for (const [dx, dy, r] of [[0.30, -0.24, 0.20], [0.10, 0.32, 0.14], [0.52, 0.14, 0.11],
    [-0.18, -0.06, 0.10]]) {
    mg.beginPath(); mg.arc(cx + dx * R, cy + dy * R, r * R, 0, Math.PI * 2); mg.fill();
  }
  const dim = mg.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
  dim.addColorStop(0, 'rgba(0,0,0,0)');
  dim.addColorStop(1, 'rgba(6,14,24,0.55)');
  mg.fillStyle = dim;
  mg.fillRect(0, 0, S, S);

  // The cold rim along the lit limb, and ONLY there. It is the one saturated
  // thing on the moon and it is what says this is lit from the side.
  mg.strokeStyle = 'rgba(196,236,250,0.9)';
  mg.lineWidth = S * 0.016;
  mg.beginPath(); mg.arc(cx, cy, R - mg.lineWidth * 0.5, 0, Math.PI * 2); mg.stroke();

  g.drawImage(m, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

  // A Sprite, because the camera's elevation is fixed and cannot be flown
  // around: a disc laid in the world is seen at 46 degrees and reads as an
  // ellipse, and a moon that is not round is not a moon. A sprite is a
  // screen-space quad, so it is circular from anywhere — and SpriteMaterial
  // carries its own `rotation`, which is what the quarter turn is spent on.
  const moonMat = new THREE.SpriteMaterial({
    map: moonTexture(LIT[phase - 1]), transparent: true, depthWrite: false,
  });
  const moon = new THREE.Sprite(moonMat);
  moon.position.set(home.x, 2.50, home.z);
  moon.scale.setScalar(MOON[phase]);
  // AFTER the halo, which is the one reason the full moon had a face at all.
  // Both sprites sit at the same point, so the transparent pass sorted them by
  // whim, and when the halo won it added a fifth of white to every pixel of
  // the moon's disc — the ACES curve took the rest, and phase 4 came back as a
  // blank pearl with no craters, no limb and no gradient in it. Drawn last,
  // the moon's own opaque disc covers the halo and the glow is only ever seen
  // AROUND it, which is what a glow is. renderOrder does not touch depthTest,
  // so nothing standing in front of it stops occluding it.
  moon.renderOrder = 3;
  kit.scene.add(moon);           // its own object: the sheet's group is yawed
  let painted = LIT[phase - 1];

  // One halo, NOT additive-stacked. Two of them summed past 1.0 in all three
  // channels under the ACES curve and the moon came back as a white pellet
  // with no crescent in it; one, kept under half opacity, is a glow.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blobTexture('rgba(226,240,220,0.9)', 'rgba(150,190,200,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  halo.renderOrder = 2;
  halo.position.copy(moon.position);
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
    moonMat.rotation = -((phase - 1) + turn) * Math.PI * 0.5 + wob;
    // It rises a little as it turns — a hand's width, which at 26 pixels a
    // unit is four pixels and is felt rather than seen.
    // 2.50 and not the 1.5 it started at. Height costs about 26 screen pixels
    // a world unit here, so at 1.5 the moon was drawn only THIRTY pixels above
    // its own pool — a sixty-pixel disc with its bottom half lying in its own
    // reflection, which is not a moon over water, it is a coin in a puddle.
    moon.position.y = 2.50 + 0.16 * smooth(t) + 0.05 * Math.sin(t * 5.5);
    const size = MOON[phase - 1] + (MOON[phase] - MOON[phase - 1]) * turn;
    moon.scale.setScalar(size);
    moonMat.opacity = smooth(t / 0.1) * (1 - smooth((t - 0.8) / 0.2));

    // Repainted only when the crescent has actually moved. At every tick this
    // was a 192-square canvas and a texture upload eighty times a firing for a
    // change of two thousandths, which is invisible and not free.
    if (Math.abs(want - painted) > 0.012) {
      moonMat.map.dispose();
      moonMat.map = moonTexture(want);
      painted = want;
    }

    halo.position.copy(moon.position);
    halo.scale.setScalar(size * (2.4 + 0.8 * want));
    // Tied to the LIT AREA and not to the phase: a thin crescent that threw
    // the same glow as a full moon was the clearest thing in the first four
    // frames and it said nothing at all.
    halo.material.opacity = moonMat.opacity * (0.06 + 0.20 * want) * gain;
  }, () => {
    // Materials and maps only. A Sprite's geometry is a MODULE-LEVEL singleton
    // in three.js, shared by every sprite in the scene — disposing it here
    // took the torch glows and the deploy burst down with it the first time.
    kit.scene.remove(moon); kit.scene.remove(halo);
    moonMat.map.dispose(); moonMat.dispose();
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
