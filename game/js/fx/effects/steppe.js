// THE WIND OFF THE STEPPE — one heading, nine squares, and the two that hold.
//
// Shared by 1 card: A040 Winds of the Steppe. "Choose a direction. Move all
// fighters that are not in any Gates 1 square in that direction. Enemy
// fighters that were Moved start their owners' next turn fatigued."
//
// WHAT REPLACED WHAT, and why the replacement is not a tuning pass. This card
// had a motif before — ./gust.js, a front of airborne dust — and the user's
// report on it was "Winds of the Steppe has no animation". That was accurate.
// The dust was built on "contrast is bought with SHADOW": a dark brown-grey
// mass that dimmed the flagstone it crossed, with its bright values capped at
// 0.32 so it could never cover a fighter's art. That rule is right for a thing
// drawn ON a lit card, and wrong for this arena. The stones are already dark,
// ACES lifts the bottom of the range enormously (linear 0.125 lands near 0.50)
// so a dark veil over dark stone barely separates from it, and the whole front
// came out at play scale as a faint pale haze you had to be told was there. A
// zoomed shot showed it drawing correctly and reading as nothing. The mistake
// was the palette, not the values in it, so this file inverts it: the wind is
// LIGHT ON THE STONE, and the darkness is the board it crosses.
//
// WHAT IT IS MADE OF, in the order it was found to be needed. Three lit LANES
// on the stone, one down each rank that runs with the wind, each 2.5 units
// across and eighteen long with a sharp lit face and four units of tail —
// that is the glow the front leaves on the floor, and on its own it was a
// handsome warm bloom that said nothing, because a warm wash over warm brown
// flagstones has almost no contrast in it. So each lane also has a narrow
// BAND in the air above it that passes over the cards and is gone again in a
// sixth of a second, and over the whole front there is pale GRIT: a hundred
// and twenty flat streaks up to two and a half units long, four pixels wide,
// flying downwind faster and slower than the front itself. The grit is what
// finally made it a wind. Height costs about 26px a world unit and width
// costs nothing, so everything here is flat and everything is long.
//
// THE STAGGER IS THE MOTIF, and it is the one thing gust.js had right. The
// card moves nine fighters at once and nine simultaneous puffs is what the
// generic flourish already does; what makes it a wind is that ONE front
// crosses and every card reacts in the order it is reached. So the three lane
// heads travel together, offset a little from each other so the front is
// broken rather than ruled, and each fighter tips as its own head arrives.
//
// AND THE TWO THAT DO NOT MOVE. Half the printed text is the exception —
// "that are not in any Gates" — so a fighter the rules left standing gets a
// DIFFERENT beat from one they shoved: the wind breaks on it, a bright bow
// wave stands off its upwind edge, and it never tips. Which is which is read
// off the board, not off the rules (see `heading`): main.js pins every card
// the rules moved at the square it LEFT while this motif runs, so a card
// sitting away from its resting place was shoved and one sitting on it held.
//
// The last clause — the fighters that were Moved start fatigued — is the
// BOARD's to draw, not this file's: a fatigued card is turned by pieces.js and
// the motif has no way to know which seat is the enemy's. What it does say is
// which fighters were dragged, by scouring the stone they were standing on and
// leaving that mark behind them as they go.
//
// LANES, NOT A SHEET. Three strokes with the flagstone joint left as a gutter
// between them read as wind finding the channels; one continuous sheet of the
// same light is a wipe being drawn across the table, and a wipe is the thing
// this most easily degrades into. The gutters, the per-lane lead offsets and
// the torn streak map are all there to stop that, and taking away any of the
// three brings it back.
//
// Checked by eye at 200ms, 280ms, 300ms and 620ms of the 1.45s span, in both
// the across-screen heading and the toward-camera one, at PLAY SCALE and not
// zoomed — zoomed is how the motif this replaced passed its own reviews.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=400" \
//             --eval tools/fxdemo/steppe.js --out /tmp/st-400.png \
//             --wait 10000 --settle 600
// ?t is milliseconds INTO the motif and ?dir=left|right|up|down|none picks the
// fake shove the harness stages, which is what this file reads the heading off.

import { THREE, CARD_W } from '../kit.js';
import { STEP } from '../../arena.js';

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rnd = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
const SPAN = 1.45;
// The front crosses its whole run in this much of the span, at a CONSTANT
// speed. Air running over a plain does not lose way the way water running up
// a beach does, and an eased front reads as a wipe being drawn rather than as
// weather going past.
const CROSS = 0.42;
const RUN = 7.6;              // half the front's travel, so it starts fully off
// A card is reached, lifts, and is set down again inside this much of the span
// after its lane head gets to it. Short on purpose: the point is the ORDER the
// nine are reached in, and a long settle smears the order into mush.
const BITE_IN = 0.035, BITE_HOLD = 0.07, BITE_OUT = 0.13;
// Every card is handed back before this, and timing.kill is a little past it,
// so main.js starts the real one-square slide while the last of the light is
// still on the stone. A card released onto a clean board reads as a second,
// separate event.
const RELEASE = 0.58;

/** How long the shoved cards must stay put. See RELEASE. */
export const timing = { kill: SPAN * RELEASE + 0.06 };

/* --------------------------------------------------------------- heights */

// Flat work sits 0.055 clear of whatever it lies on: the flagstone face is at
// 0.080 and a card's slab runs 0.185 to 0.220, so at less clearance the depth
// test (gl.LESS fails on equal) drops a decal on the stone AROUND a card but
// not beside it. Everything in this motif is at stone height and NOTHING is
// lifted onto a card face — which is what lets the light be as strong as it
// likes: a card standing in a lane occludes it, so no fighter's art is ever
// covered, and the lane reappearing on the far side of a card is the frame
// that says the wind went PAST it.
const GROUND = 0.08 + 0.055;
// ...but the stone is not enough ON ITS OWN, and that was the second thing
// wrong with the motif this replaced. A card is 1.74 across of a 2.5 flagstone,
// so on a full board only a twelve-pixel margin of stone is visible at all and
// anything drawn there comes out as a highlight on a card edge rather than as
// weather on a floor. So the front ALSO passes over the cards, in the air, as
// a narrow lit band that is gone again in a sixth of a second. Air really does
// go over the fighters; the rule it must obey is that it may not HIDE one, so
// the airborne band is capped at 0.46 and is a band and never a blanket.
const AIR = 0.21 + 0.055;

/* ---------------------------------------------------------------- colour */

// Dry grass and grit off a plain at dusk, lit by the key at (-24,27,17). The
// tail is a dull ember and the head is near white-gold, and the distance
// between them is what gives the stroke a direction when it is standing still
// in a frozen shot.
//
// Chosen by what they LAND at, not by what they read as in source: ACES is
// nearly flat at the top, so 0xffe3b0 and 0xfff4dd are the same colour on
// screen and only the second one risks the head of three lanes summing past
// white where they overlap the torchlight. Nothing here is additive for the
// same reason.
const TAIL = new THREE.Color(0x8a4a14);
// Auroxi's own spark colour, from kit.FACTION. The card is an Auroxi tactic
// and the flourish it would otherwise have taken is lit with this, so the
// board stays one piece of magic.
const HEAD = new THREE.Color(0xffb257);
// THE PALE VALUES GO ON THE THIN THINGS ONLY, and that is the last thing this
// motif had to learn. The flagstones are lit warm brown by the key and the
// torches, so a warm gold wash over them barely separates — the first cut of
// the lanes was a handsome warm bloom that said nothing. What separates from a
// warm brown board is PALE, and pale is safe here precisely because everything
// carrying it is a hairline: a near-white rim at the face of the front and
// near-white grit four pixels wide cannot become the white slab that ACES
// makes of anything broad and bright.
const RIM = new THREE.Color(0xffe8c6);
const GRIT = new THREE.Color(0xfff2dc);
const BRACE = new THREE.Color(0xffcf8d);

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials and a material
// never disposes its map, so a canvas built per cast is a leak.
const TEX = new Map();
function tex(key, paint, w, h) {
  let t = TEX.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    TEX.set(key, t);
  }
  return t;
}

/**
 * The grain inside a lane: long thin streaks running the way the wind runs,
 * over a field that stays MOSTLY opaque.
 *
 * This map multiplies the per-vertex alpha, so its average is a tax on every
 * value in the tick below. Drawn the tempting way round — start empty, add
 * bright streaks — its average is about 0.2 and a lane asking for 0.7 gets
 * 0.14, which is the exact failure the old dust died of. So it starts near
 * solid and is only TORN, lightly, and the streaks are brightenings of an
 * already-lit field rather than the field itself.
 *
 * SIX OF THEM, one per sheet, keyed and cached at module level. Each sheet
 * scrolls its map at its own speed, and a shared texture has ONE offset — the
 * six writes fight and every sheet takes the last one written. Cloning the
 * texture per cast fixed that and leaked a GPU texture every time the card was
 * played: kit.hold disposes materials, and a material never disposes its map.
 *
 * Wrapped at both seams, because the lane scrolls this map along faster than
 * the front moves — that is what makes the grit travel THROUGH the light
 * instead of the light being a decal slid across the board — and a seam
 * crossing the board once a frame is a visible bar.
 */
const laneTex = (n) => tex(`steppe-lane${n}`, (g, W, H) => {
  g.fillStyle = 'rgba(255,255,255,0.72)';
  g.fillRect(0, 0, W, H);
  // The streaks. Wildly different lengths: at one length they came out as
  // even hatching, which is a texture and not weather.
  for (let i = 0; i < 130; i++) {
    const y = Math.random() * H;
    const len = rnd(W * 0.10, W * 0.92);
    const x = Math.random() * W;
    const th = rnd(1.0, 4.2);
    const a = rnd(0.10, 0.28);
    for (const ox of [-W, 0, W]) {
      for (const oy of [-H, 0, H]) {
        const grd = g.createLinearGradient(x + ox, 0, x + ox + len, 0);
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(0.35, `rgba(255,255,255,${a})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(x + ox, y + oy - th / 2, len, th);
      }
    }
  }
  // ...and torn along the wind, lightly. The holes are what make a lane a
  // bundle of blown grit rather than a ruled bar of light; torn any harder the
  // average falls off a cliff and the whole motif goes quiet again.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const rx = rnd(W * 0.05, W * 0.28), ry = rnd(H * 0.02, H * 0.10);
    const a = rnd(0.25, 0.85);
    for (const ox of [-W, 0, W]) {
      for (const oy of [-H, 0, H]) {
        g.save();
        g.translate(x + ox, y + oy);
        g.scale(rx, ry);
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        grd.addColorStop(0, `rgba(255,255,255,${a})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }
  g.globalCompositeOperation = 'source-over';
}, 256, 128);

// NO CHEVRON. "Choose a direction" is the first thing the card says, and the
// obvious way to state it is an arrowhead riding the front of each lane. It
// was built, photographed, and cut: three chevrons over the board read as
// GLYPHS drawn on the table — UI, not weather — and at the brightness that
// made them legible they were the loudest thing in the frame by a distance.
// The heading is carried instead by everything that is already physical about
// it: the sharp lit face against the long tail behind it, the cards tipping
// and sliding downwind in the order they are reached, the drag marks pointing
// back at the squares the fighters came off, and the bow waves standing on the
// UPWIND side of the ones that would not move.

/**
 * The bow wave that stands off a fighter the wind could not move: a crescent,
 * bulging INTO the wind, brightest at its middle where the stone takes the
 * whole of it.
 */
const braceTex = () => tex('steppe-brace', (g, W, H) => {
  g.lineCap = 'round';
  for (const [w, a] of [[H * 0.30, 0.28], [H * 0.13, 1.0]]) {
    g.strokeStyle = `rgba(255,255,255,${a})`;
    g.lineWidth = w;
    g.beginPath();
    // Opening downwind (to the right): the arc's belly faces the oncoming
    // wind, which is the shape water makes in front of a stone in a stream.
    g.ellipse(W * 0.78, H * 0.5, W * 0.52, H * 0.36, 0, Math.PI * 0.62, Math.PI * 1.38);
    g.stroke();
  }
}, 128, 96);

/**
 * One airborne streak of grit, smeared by its own speed: a soft lozenge with
 * its weight at the leading end and a tail behind it.
 *
 * Flat quads and not sprites. A camera-facing blob at this size is a round
 * bright dot and forty round bright dots are lens bokeh, which the eye goes to
 * instead of the board. Lying flat and stretched along the wind they are grit
 * going past — and LENGTH IS THE WHOLE POINT: a speck is sub-pixel and a
 * sub-pixel detail is an absent detail, but a streak two units long is sixty
 * pixels of unmistakable motion for the same nothing of height.
 */
const streakTex = () => tex('steppe-streak', (g, W, H) => {
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.30)');
  grd.addColorStop(0.88, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // ...and pinched top and bottom, or every speck is a rectangle with soft
  // ends, which at four pixels tall is a dash of morse code.
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(0.5, 'rgba(255,255,255,1)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}, 96, 24);

/**
 * What a dragged fighter leaves on the stone it was standing on: a smear
 * along the wind, thin at the upwind end and wide where the card was.
 */
const dragTex = () => tex('steppe-drag', (g, W, H) => {
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.42, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.80, 'rgba(255,255,255,0.95)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(0.5, 'rgba(255,255,255,1)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  // Scratched along its length, or it is an airbrushed oval.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd(0.2, 0.7)})`;
    g.fillRect(rnd(0, W), rnd(0, H), rnd(W * 0.08, W * 0.4), rnd(1, 3));
  }
  g.globalCompositeOperation = 'source-over';
}, 160, 64);

/* --------------------------------------------------------------- geometry */

/** A grid of quads in the local xz plane with per-vertex RGBA and uv. */
function sheetGeo(U, V, ru, rv) {
  const geo = new THREE.BufferGeometry();
  const NU = U.length, NV = V.length;
  const pos = new Float32Array(NU * NV * 3);
  const uv = new Float32Array(NU * NV * 2);
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const n = (i * NV + j) * 3;
      pos[n] = U[i]; pos[n + 2] = V[j];
      uv[(i * NV + j) * 2] = U[i] / (2 * ru);
      uv[(i * NV + j) * 2 + 1] = V[j] / (2 * rv);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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

/**
 * A bag of flat axis-aligned quads in the wind's own frame, rewritten each
 * frame. Every mark in this motif that is not a lane is one of these: a bow
 * wave per fighter that held, a drag mark per fighter that went.
 */
function quads(parent, n, map, order, y = 0) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 4 * 3);
  const col = new Float32Array(n * 4 * 4);
  const uv = new Float32Array(n * 4 * 2);
  const idx = [];
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    uv.set([0, 1, 1, 1, 1, 0, 0, 0], a * 2);
    idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map, vertexColors: true, transparent: true, depthWrite: false,
    side: THREE.DoubleSide,
  }));
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  parent.add(mesh);

  /** Lay quad `i` centred at local (u,v), `hu` by `hv`, in `c` at `a`. */
  const put = (i, u, v, hu, hv, c, a) => {
    const q = i * 4;
    const P = [[u - hu, v + hv], [u + hu, v + hv], [u + hu, v - hv], [u - hu, v - hv]];
    for (let k = 0; k < 4; k++) {
      pos[(q + k) * 3] = P[k][0];
      pos[(q + k) * 3 + 1] = y;
      pos[(q + k) * 3 + 2] = P[k][1];
      col[(q + k) * 4] = c.r; col[(q + k) * 4 + 1] = c.g;
      col[(q + k) * 4 + 2] = c.b; col[(q + k) * 4 + 3] = a;
    }
  };
  const flush = () => {
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return { put, flush };
}

/* --------------------------------------------------------------- heading */

/**
 * Which way the wind is blowing, read off the cards it has already shoved.
 *
 * The rules never tell the effect the direction the player chose — defaultCast
 * hands it a card uid and nothing else — so it comes OFF THE BOARD. main.js
 * pins every card the rules moved at the square it LEFT while it waits out
 * this file's timing.kill, so at the moment the motif starts every shoved
 * fighter is standing one square upwind of where it belongs. Averaging
 * (resting - standing) over them gives the heading exactly, for free.
 *
 * Snapped to the four orthogonals the card actually offers: a rules move is
 * never diagonal, and a heading averaged over two fighters that were blocked
 * differently would be. A diagonal front over an orthogonal shove is the sort
 * of wrong that reads before it is understood.
 *
 * With nothing pinned — the effects bench, or a board where every fighter was
 * blocked — it falls back to -x, which turns the lit heads toward the key
 * light at (-24,27,17).
 */
function heading(kit) {
  let sx = 0, sz = 0, n = 0;
  for (const piece of kit.pieces?.byUid?.values?.() || []) {
    if (!(piece.square >= 0 && piece.square < 9)) continue;
    const rest = piece.restingPosition?.();
    if (!rest) continue;
    const dx = rest.x - piece.group.position.x;
    const dz = rest.z - piece.group.position.z;
    // Half a square: a card merely lerping home after a hover is a few
    // hundredths out and must not be mistaken for a shove.
    if (Math.hypot(dx, dz) < STEP * 0.5) continue;
    sx += dx; sz += dz; n++;
  }
  if (!n) return new THREE.Vector3(-1, 0, 0);
  return Math.abs(sx) >= Math.abs(sz)
    ? new THREE.Vector3(Math.sign(sx) || -1, 0, 0)
    : new THREE.Vector3(0, 0, Math.sign(sz));
}

/* ------------------------------------------------------------------ main */

export function steppe(kit) {
  // NO `kit.at(at)` GUARD. Winds of the Steppe is a tactic, so by the time the
  // motif plays the card that resolved is in the graveyard and kit.at answers
  // null — a motif that bailed on that would never once play in a real game.
  // This effect belongs to the whole board, not to a square.
  const dir = heading(kit);
  const yaw = Math.atan2(-dir.z, dir.x);          // local +x runs downwind
  // rotation.y maps local (x,0,z) onto world (x cos + z sin, 0, -x sin + z cos),
  // so a world point comes back to local (u,v) with (x cos - z sin, x sin + z cos).
  const cy = Math.cos(yaw), sy = Math.sin(yaw);

  const wind = new THREE.Group();
  wind.position.y = GROUND;
  wind.rotation.y = yaw;

  /* ------------------------------------------------------------ the lanes */

  // HU is half the run the light is drawn over — longer than the board, so the
  // lane is already lit off the upwind edge and carries on off the downwind
  // one. A stroke that begins at the first flagstone is a stroke being drawn;
  // one that arrives from off the table is weather.
  const HU = 9.0;
  // Half the lane's width. 2.5 across of a 2.62 pitch — the flagstone itself,
  // with the 0.12 joint left as the gutter. A card is 1.74 wide, so what shows
  // down either side of a fighter is 0.38 of a unit, about twelve pixels: thin,
  // but a sub-pixel detail is an ABSENT detail and this is not one. Narrower
  // (2.3) it was nine pixels and the lane vanished wherever a card stood.
  const HV = 1.25;
  const NU = 132, NV = 9;
  const U = new Float32Array(NU), V = new Float32Array(NV);
  for (let i = 0; i < NU; i++) U[i] = -HU + (2 * HU * i) / (NU - 1);
  for (let j = 0; j < NV; j++) V[j] = -HV + (2 * HV * j) / (NV - 1);

  // The front is BROKEN rather than ruled: each lane's head leads or lags the
  // others by a fraction of a square. Aligned, the three heads are one bar
  // sliding across the board — which is a wipe, and a wipe is what this most
  // easily degrades into.
  const LEAD = [0.34, -0.12, 0.20];

  const sheet = (L, y, order, ru, n) => {
    const geo = sheetGeo(U, V, ru, HV);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: laneTex(n), vertexColors: true, transparent: true, depthWrite: false,
      side: THREE.DoubleSide,
    }));
    mesh.position.set(0, y, (L - 1) * STEP);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    wind.add(mesh);
    return { mesh, col: geo.attributes.color.array };
  };

  const lanes = [];
  for (let L = 0; L < 3; L++) {
    lanes.push({
      lead: LEAD[L],
      // On the stone, under the cards: the long glow the front leaves behind.
      stone: sheet(L, 0, 2, 3.4, L),
      // In the air, over the cards: the front itself, and only the front. A
      // coarser map scale so the two layers do not moire into a plaid where
      // they overlap.
      air: sheet(L, AIR - GROUND, 6, 5.6, 3 + L),
    });
  }

  // Across the lane: full strength down the middle, faded out at both sides so
  // the stroke has soft edges. A straight-cut side is a card being dealt.
  const FLANK = new Float32Array(NV);
  for (let j = 0; j < NV; j++) FLANK[j] = smooth((1 - Math.abs(V[j] / HV)) / 0.34) ** 0.8;
  // ...and it dies off both ENDS of its run. Without this the light carried on
  // over the apron and the near Stronghold after it had left the last
  // flagstone, so an effect about the nine squares was at its largest when it
  // had finished with them.
  const EDGE = new Float32Array(NU);
  for (let i = 0; i < NU; i++) EDGE[i] = smooth((5.6 - Math.abs(U[i])) / 2.2) ** 0.8;

  /* ------------------------------------------------- the cards it passes */

  // EVERY fighter on the nine squares, shoved or not. The ones the rules left
  // standing are half the printed text and they get the louder mark.
  const riders = [];
  for (const piece of kit.pieces?.byUid?.values?.() || []) {
    if (!(piece.square >= 0 && piece.square < 9)) continue;
    const home = piece.group.position.clone();
    const rest = piece.restingPosition?.() || home;
    riders.push({
      piece,
      home,
      // A card main.js has PINNED belongs to the slide that is coming, so it
      // is handed back still `animating`; one that is merely standing there
      // has to be handed back free or it freezes where this left it. The same
      // test is what tells a shoved fighter from one in a Gate.
      mover: home.distanceTo(rest) > STEP * 0.5,
      u: home.x * cy - home.z * sy,
      v: home.x * sy + home.z * cy,
      done: false,
    });
  }
  /* ----------------------------------------------------------- the grit */

  // Over the cards, because that is where it can be SEEN, and thin enough that
  // it never hides one. Lengths vary by more than an order of magnitude: at
  // one length forty parallel lines across the board are RAIN, which is the
  // one weather this is not.
  const NS = 120;
  const STREAKS = quads(wind, NS, streakTex(), 8, AIR - GROUND + 0.012);
  const grit = [];
  for (let i = 0; i < NS; i++) {
    grit.push({
      u0: rnd(-HU - 4, HU * 0.3),
      v: rnd(-3.7, 3.7),
      // Straddling the front's own 25 units a second, so some grit runs out
      // ahead of the light and some trails in it. All at one speed it is a
      // diagram of a vector field.
      speed: rnd(19, 31),
      len: 0.30 + 2.4 * Math.random() ** 2,
      // Three to five pixels at this camera. Thinner and it is not there at
      // all; thicker and a hundred and twenty of them are a sheet.
      wide: rnd(0.07, 0.15),
      alpha: rnd(0.5, 1.0),
    });
  }

  const held = riders.filter((r) => !r.mover);
  const went = riders.filter((r) => r.mover);
  const BRACES = quads(wind, Math.max(1, held.length), braceTex(), 4);
  const DRAGS = quads(wind, Math.max(1, went.length), dragTex(), 3);

  const c = new THREE.Color();

  kit.hold(wind, SPAN, (t) => {
    const front = -RUN + 2 * RUN * (t / CROSS);
    const env = smooth(t / 0.05) * (1 - smooth((t - 0.80) / 0.20));
    // WHAT HANGS. The light is tied to the front and is off the far edge by
    // about four tenths of the span, which would leave the board swept clean
    // for a third of a second before the fighters are handed over to their
    // real slide — a dead stretch, and then a second unrelated event. So
    // everywhere the front HAS been keeps a thin warmth that dies slowly, and
    // the cards make their move through the last of it.
    const hang = 1 - smooth((t - 0.38) / 0.58);

    for (let L = 0; L < 3; L++) {
      const lane = lanes[L];
      // The maps are dragged along faster than the front, which is what makes
      // the grit travel THROUGH the light rather than the light being a decal
      // slid across the board. Two numbers a frame against five thousand.
      lane.stone.mesh.material.map.offset.x = -t * (2.4 + L * 0.35);
      lane.air.mesh.material.map.offset.x = -t * (3.1 + L * 0.3);
      const col = lane.stone.col;
      const airCol = lane.air.col;
      for (let i = 0; i < NU; i++) {
        const d = U[i] - (front + lane.lead);
        // Behind the front and nowhere else. The leading edge is SHARP (a
        // quarter of a unit) and everything behind it trails away: wind has a
        // face and no back, and a symmetric band reads as a bar sliding past.
        const face = smooth(-d / 0.26);
        // FOUR UNITS OF TAIL, not one. At exp(d/1.3) the lit part of a lane
        // was about a unit long — a blob riding across the board rather than a
        // stroke — and with two thirds of every rank hidden under a card, a
        // blob is only ever seen in the joints. A tail this long keeps a whole
        // rank glowing while the front is on the next one, which is what makes
        // the three lanes read as lanes.
        const tail = Math.exp(d / 2.40);
        const swept = smooth(-d / 2.8) * hang;      // it has been through here
        // The lit rim: a narrow band right at the face, where the grit is
        // thickest and takes the whole of the key. It is the single most
        // legible mark the motif has, because an EDGE crossing the stones is
        // read long before a gradient on them is.
        const rim = Math.exp(-((d + 0.18) ** 2) / 0.05);
        const lit = clamp01(face * tail * 1.25);
        const mass = (face * tail + swept * 0.5) * EDGE[i] * env;
        c.copy(TAIL).lerp(HEAD, lit).lerp(RIM, clamp01(rim * face));
        // In the air it is the FRONT and nothing else: a short tail, no
        // lingering haze, and a hard cap. A wash that stayed on the cards for
        // the length of the stone's tail would be a grey sheet over six
        // fighters' art, which is the one thing this may not do.
        const airMass = (face * Math.exp(d / 0.95) * 0.55 + rim * face * 0.95)
          * EDGE[i] * env;
        for (let j = 0; j < NV; j++) {
          const n4 = (i * NV + j) * 4;
          col[n4] = c.r; col[n4 + 1] = c.g; col[n4 + 2] = c.b;
          col[n4 + 3] = Math.min(0.92, (mass + rim * face * 0.45 * EDGE[i] * env) * FLANK[j]);
          airCol[n4] = c.r; airCol[n4 + 1] = c.g; airCol[n4 + 2] = c.b;
          airCol[n4 + 3] = Math.min(0.55, airMass * FLANK[j]);
        }
      }
      lane.stone.mesh.geometry.attributes.color.needsUpdate = true;
      lane.air.mesh.geometry.attributes.color.needsUpdate = true;
    }

    /* ---- the grit ---- */
    for (let i = 0; i < NS; i++) {
      const s2 = grit[i];
      const u = s2.u0 + s2.speed * t * SPAN;
      // Alive in a band that runs from a little AHEAD of the front to three
      // units behind it, and only over the board. Written the other way round
      // every speck was drawn downwind of light that had not arrived yet —
      // grit racing ahead of its own gust, which reads as a bug before it
      // reads as anything.
      const live = smooth((front + 1.4 - u) / 0.8)
        * (1 - smooth((front - u - 4.0) / 2.2))
        * (1 - smooth((Math.abs(u) - 3.9) / 1.3))
        * env;
      STREAKS.put(i, u, s2.v, s2.len * (0.6 + 0.4 * live), s2.wide,
        GRIT, s2.alpha * live);
    }
    STREAKS.flush();

    /* ---- the fighters the wind could not move ---- */
    // The bow wave stands off the upwind edge of the card and STAYS UP while
    // the front is on it, rather than flashing once: the whole point is that
    // this fighter is still there after the wind has gone past, and a mark
    // that came and went reads the same as the tip every other card is doing.
    for (let i = 0; i < held.length; i++) {
      const r = held[i];
      const d = r.u - front;
      const on = smooth((-d + 0.9) / 0.5) * (1 - smooth((-d - 2.6) / 1.2)) * env;
      const push = 0.16 * smooth((-d + 0.6) / 0.7);
      BRACES.put(i, r.u - CARD_W * 0.5 - 0.46 + push, r.v, 0.62, 1.05, BRACE, 0.72 * on);
    }
    BRACES.flush();

    /* ---- and the stone the ones that went were standing on ---- */
    // Scoured pale, then left behind. This is the only mark in the motif that
    // says WHICH fighters the rules actually moved, and it is still on the
    // board when main.js starts their real slide out of it.
    for (let i = 0; i < went.length; i++) {
      const r = went[i];
      const d = r.u - front;
      const on = smooth((-d + 0.4) / 0.45) * (1 - smooth((-d - 3.0) / 2.2)) * env;
      DRAGS.put(i, r.u + 0.30, r.v, 1.15, 0.62, HEAD, 0.62 * on);
    }
    DRAGS.flush();

    /* ---- the cards, flinching in the order they are reached ---- */
    for (const r of riders) {
      if (r.done) continue;
      const piece = r.piece;
      if (!piece.group.parent) { r.done = true; continue; }
      // Arrival, as a fraction of the span: where the front is level with the
      // card. This is the whole stagger, and it is measured off the SAME front
      // the light is drawn from, so the two can never drift apart.
      const arrive = ((r.u + RUN) / (2 * RUN)) * CROSS;
      const k = t - arrive;
      const bite = smooth(k / BITE_IN)
        * (1 - smooth((k - BITE_IN - BITE_HOLD) / BITE_OUT));
      if (t >= RELEASE) {
        piece.group.position.copy(r.home);
        piece.group.rotation.set(0, 0, 0);
        piece.animating = r.mover;
        r.done = true;
        continue;
      }
      piece.animating = true;
      // A fighter in a Gate does not go with the wind, so it does not travel
      // and it barely tips — it only shudders. Giving it the same lean as the
      // rest was the single thing that made the Gates disappear into the nine.
      const gain = r.mover ? 1 : 0.32;
      const tip = 0.17 * bite * gain;
      piece.group.rotation.x = tip * -dir.z;
      piece.group.rotation.z = tip * dir.x;
      piece.group.position.set(
        r.home.x + dir.x * 0.20 * bite * gain,
        r.home.y + 0.055 * bite * gain,
        r.home.z + dir.z * 0.20 * bite * gain,
      );
    }
  }, () => {
    for (const r of riders) {
      if (r.done) continue;
      const piece = r.piece;
      if (!piece.group.parent) continue;
      piece.group.position.copy(r.home);
      piece.group.rotation.set(0, 0, 0);
      piece.animating = r.mover;
    }
  });
}
