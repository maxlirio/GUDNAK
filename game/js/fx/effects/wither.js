// WITHER — a fighter taken by rot and cold pyre, with no blow ever landing.
//
// Shared by 2 cards: Funeral Pyre (R076) and Fratricide (C113). Both are
// deaths without an impact, so there is no burst, no shock ring and nothing
// that flies outward: the card is EATEN, in one unhurried pass, and what is
// left of it blows away.
//
// The shape of it, in the order you see it: the colour drains out of the card
// — it cools and dulls before anything touches it — then a ragged line of
// corpse-light takes the far edge and creeps across, near-black rot behind it
// and grave-dust lifting off it; the line runs off the near edge, the char
// ashes over to one dead grey, and the husk comes apart.
//
// Three things it deliberately is NOT.
//
// It is not fire.js. That motif owns hot orange flame that CLIMBS off a card
// in tongues a card-width tall. Everything here hugs the card: the burn is a
// flat front you look down on, the tallest thing in it is about a fifth of a
// card, and the hot end of its ramp is a sickly green — never white, never
// orange. A pyre that is cold has to be cold in its shape as well as its hue.
//
// It is not cast-gloaming.js, the faction's everyday flourish, which opens a
// soft dark pool and lets motes SINK into it. So the dark here does not close
// concentrically and nothing falls: the front is directional, it sweeps, and
// the ash goes UP.
//
// And it is not a blow. Nothing is thrown at the card, nothing recoils, and
// the card's only movement is a slow sag as the rot takes the half it has
// already eaten.
//
// BOTH ENDS OF IT ARE HERE. `wither` is what you see on the card that
// resolved; `exit.destroy` at the bottom is what becomes of each card it
// kills. They are the same event, so they are the same rig (see `rotRig`) —
// written twice they drifted apart within an hour of tuning.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=400" \
//             --eval tools/fxdemo/wither.js --out /tmp/w.png --settle 700
//           node tools/shot.js --url "game/?quick=1&seed=5&t=900" \
//             --eval tools/fxdemo/witherexit.js --out /tmp/we.png --settle 900
// `t` is the moment to freeze at, in ms. --settle is wall clock and headless
// animation time runs at a fraction of it, so the harnesses take the animator
// off the frame clock and step it by hand; see them for why.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';

/* ------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold() disposes materials and a
// material never disposes its map, so the second Funeral Pyre of a game must
// not pay for canvas work again.
const TEXES = new Map();
function tex(key, make) {
  let t = TEXES.get(key);
  if (!t) { t = make(); TEXES.set(key, t); }
  return t;
}

/**
 * The raggedness of the rot, as three octaves of value noise in R, G and B.
 *
 * R warps the front so it is a torn edge and not a ruled line; G mottles what
 * is left behind so the char is not a flat wash; B decides which flecks of
 * that char blow away first at the end.
 *
 * Value noise built by hand rather than a canvas of random pixels: a per-pixel
 * random warp turns the front into static, and blurring random pixels gives
 * you grey. The grid sizes are what set the SCALE of the tearing, and they
 * have to be coarse — six cells across a card that is sixty screen pixels wide
 * is a tear about ten pixels long, which is the smallest tear that survives.
 */
const noiseTex = () => tex('noise', () => {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);

  const field = (cells) => {
    const w = cells + 1;
    const v = new Float32Array(w * w);
    for (let i = 0; i < v.length; i++) v[i] = Math.random();
    return (x, y) => {
      const fx = x * cells, fy = y * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx);          // smoothstep, or the cells show up
      ty = ty * ty * (3 - 2 * ty);          // as diamonds
      const at = (yy, xx) => v[(yy % cells) * w + (xx % cells)];
      const top = at(y0, x0) + (at(y0, x0 + 1) - at(y0, x0)) * tx;
      const bot = at(y0 + 1, x0) + (at(y0 + 1, x0 + 1) - at(y0 + 1, x0)) * tx;
      return top + (bot - top) * ty;
    };
  };

  const coarse = field(6), mid = field(13), fine = field(26);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, w = y / S;
      const k = (y * S + x) * 4;
      img.data[k + 0] = 255 * Math.min(1, coarse(u, w) * 0.68 + mid(u, w) * 0.32);
      img.data[k + 1] = 255 * Math.min(1, mid(u, w) * 0.6 + fine(u, w) * 0.4);
      img.data[k + 2] = 255 * Math.min(1, fine(u, w) * 0.55 + coarse(u, w) * 0.45);
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // NOT tagged sRGB: this is a control signal the shader reads, not a colour.
  // Decoded as sRGB the low half of the noise is crushed and the front tears
  // in one direction only.
  //
  // Tiling, because each rig reads it at its own offset. `at()` above indexes
  // the lattice modulo `cells`, so the field already wraps on both axes and an
  // offset costs nothing. Funeral Pyre kills four cards at once and all four
  // tore along exactly the same scalloped line without this — four copies of
  // one shape is the most mechanical thing a screen can show.
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
});

/**
 * A flake of ash: a torn scrap, not a dot.
 *
 * A round blob is a spark whatever colour it is painted, and sparks are the
 * one thing this motif must not have.
 *
 * Heavily blurred, and a SLIVER rather than a polygon. The first version was a
 * seven-sided scrap with a 1.4px blur and a strong side-light, and on the
 * table that is a hard white TRIANGLE: at six screen pixels the silhouette is
 * all there is, and a pointed one reads as confetti or a bird, not as ash. A
 * soft-ended sliver has no corners to catch on.
 */
const flakeTex = () => tex('flake', () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.filter = 'blur(3.2px)';
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 17 * (1 + 0.18 * Math.sin(i * 1.7));
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r * 0.42);
  }
  g.closePath();
  const grd = g.createLinearGradient(-16, -8, 13, 9);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.72)');
  grd.addColorStop(1, 'rgba(255,255,255,0.28)');
  g.fillStyle = grd;
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/**
 * Grave-dust in the air: a soft lump with bites taken out of its edge.
 *
 * Not the same as `lobe`. A clean radial blob used as smoke is a glowing ball
 * however it is tinted — smoke needs a torn silhouette, because what you
 * actually read at a distance is its EDGE against the board.
 */
const cloudTex = () => tex('cloud', () => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const lobe = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.5, `rgba(255,255,255,${a * 0.5})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  };
  lobe(64, 66, 60, 0.6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    lobe(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 20, 30, 0.34);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const r = 38 + Math.random() * 22;
    g.beginPath();
    g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 10 + Math.random() * 14, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/** A soft lobe: the low guttering light, and the corpse-motes. */
const lobeTex = () => tex('lobe', () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.46)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/* ------------------------------------------------------- the burn, in GLSL */

// The front is a shader and not an animated canvas on purpose. A canvas the
// size of a card redrawn every frame is a texture upload every frame, and the
// only thing that differs between two of those frames is ONE NUMBER — how far
// the line has got. That number is a uniform here, and the tearing comes out
// of a texture painted once.

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Shared preamble: where a pixel sits in the card's own sweep coordinate.
//
// The plane is laid flat with rotation.x = -PI/2, which sends its local +Y to
// world -Z, so `s = 1 - vUv.y` runs 0 at the far edge to 1 at the near one and
// the front crosses the card TOWARD the player. The noise term is how far the
// torn edge may run ahead of or behind the line; the front travels from -0.2
// to 1.2 so that it both arrives and leaves completely.
const SWEEP = `
  uniform sampler2D noiseMap;
  uniform vec2 nOff;
  uniform float front;
  varying vec2 vUv;
  float sweepAt(out vec3 n) {
    n = texture2D(noiseMap, vUv + nOff).rgb;
    return (1.0 - vUv.y) + (n.r - 0.5) * 0.30;
  }
`;

/**
 * What the rot does to the card face, on both sides of the line.
 *
 * Ordinary blending, not additive. This is the only part of the motif that
 * takes light AWAY, and it is what makes the card read as destroyed — the
 * glowing line is only the edge of it.
 */
const CHAR_FRAG = `${SWEEP}
  uniform float fade;
  uniform float crumble;
  void main() {
    vec3 n;
    float d = front - sweepAt(n);
    vec3 col;
    float a;
    if (d > 0.0) {
      // BEHIND the line: grave-dust in a thin band, near-black violet deeper
      // in. Taken to black over a quarter of the card that band was a grey
      // wash that LIGHTENED the art instead of killing it; over a tenth it
      // reads as a line of ash with the dark coming up right behind it.
      //
      // The deep end is a dark ash-violet and not black. At (0.03,0.015,0.05)
      // the middle of the card was a featureless hole punched in the board;
      // lifted a little, the grain below has something to work on and it reads
      // as soot lying on a card instead of as nothing at all.
      col = mix(vec3(0.58, 0.55, 0.60), vec3(0.062, 0.050, 0.082),
                smoothstep(0.008, 0.10, d));
      // grain in the BRIGHTNESS as well as the alpha: alpha alone let the card
      // art show through the light patches and the char read as a shadow
      col *= 0.4 + 1.25 * n.g;
      a = smoothstep(0.0, 0.030, d) * (0.66 + 0.34 * n.g);
    } else {
      // AHEAD of the line: the card SICKENS before the rot arrives. This band
      // used to be an additive violet haze and that was the single worst thing
      // in the motif — a soft glow in front of a moving line is what a magic
      // wand does, not what rot does. Drawn instead as a dull olive-grey that
      // takes light OUT, it reads as the art going off, and the additive part
      // of the line could then be pulled in tight where it belongs.
      col = vec3(0.19, 0.22, 0.16) * (0.7 + 0.6 * n.g);
      a = exp(d * 10.0) * 0.52;
    }
    // The end ASHES OVER. Two earlier passes had the char simply dissolve, and
    // both finished with the card's art coming back through in full colour —
    // the card is dimmed by a multiply on its own material, and a multiply
    // cannot take the COLOUR out of anything. This layer can: as the burn
    // finishes all of it goes to one grave-dust grey, and that grey film is
    // what leaves a husk behind instead of a card in shadow.
    col = mix(col, vec3(0.26, 0.245, 0.285) * (0.55 + 0.9 * n.g), crumble);
    a *= fade;
    // and only some of it blows away: flecks leave in the order the fine
    // octave picks, so the film breaks up as it pales rather than dimming
    // evenly, which looked like the effect being switched off.
    a *= 1.0 - smoothstep(n.b * 0.8, n.b * 0.8 + 0.3, crumble) * 0.6;
    if (a <= 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * The line itself: a green core with a violet bleed, wider AHEAD of the front
 * than behind it — the card is poisoned before it dies, and the dead side has
 * finished glowing.
 */
const EMBER_FRAG = `${SWEEP}
  uniform float fade;
  uniform float time;
  void main() {
    vec3 n;
    float d = sweepAt(n) - front;
    // AHEAD and BEHIND, multiplied, not maxed. Each term is 1 on its own side
    // of the line, so max() of the two is 1 everywhere — the first pass of
    // this painted the WHOLE CARD violet, because the line had no falloff at
    // all and was effectively a floodlight under the art.
    float ahead = exp(-max(d, 0.0) * 30.0);
    float behind = exp(min(d, 0.0) * 26.0);
    float band = ahead * behind;
    float core = exp(-abs(d) * 190.0);
    // Guttering, driven by the noise as well as by a travelling wave: a pure
    // sine left an evenly scalloped ribbon that read as neon piping. Patches
    // where the line is nearly OUT are what make it look like something
    // burning badly instead of something switched on.
    float gut = smoothstep(0.18, 0.72, n.g * 0.55
      + 0.45 * (0.5 + 0.5 * sin(vUv.x * 13.0 + time * 5.0)));
    gut = 0.06 + 0.94 * gut;
    // Measured off the screen, not guessed. The version that looked right in
    // the material photographed at (223,255,197) — a WHITE WIRE with a green
    // hint, because the green channel was clipping and the other two were
    // riding up with it, and the renderer tone-maps with ACES so anything near
    // (1,1,1) comes out as a scratch. These numbers photograph at about
    // (172,149,196): a violet line with corpse-green only in the hottest
    // flecks of it, which is the Gloaming and not a neon tube.
    vec3 col = mix(vec3(0.15, 0.035, 0.30), vec3(0.11, 0.36, 0.17), core);
    col += vec3(0.08, 0.28, 0.12) * core * core * 0.8;
    float a = band * gut * fade;
    if (a <= 0.004) discard;
    // alpha 1, with the strength carried in RGB. THREE.AdditiveBlending is
    // (src * srcAlpha + dst), so writing the strength into BOTH squares it and
    // the line came out at a third of the brightness it was written for.
    gl_FragColor = vec4(col * a, 1.0);
  }
`;

/* ---------------------------------------------------------------- timing */

const SPAN = 1.38;      // the motif, on the card that resolved
const COOL = 0.07;      // the colour draining out, before anything touches it
const CROSS = 0.88;     // the front has run off the near edge by here
const RUN = CROSS - COOL;
const rnd = (a, b) => a + Math.random() * (b - a);
const WHITE = new THREE.Color(1, 1, 1);

/** Where the front is, in sweep units, at `sec`. */
function frontAt(sec) {
  const k = Math.min(1, Math.max(0, (sec - COOL) / RUN));
  // Slightly DECELERATING. At k**1.18 the rot had crossed a tenth of the card
  // after 300ms — the effect had not announced itself by the time a player has
  // looked at it. Front-loaded it is a quarter of the way over by then, and
  // the last of it can afford to crawl.
  return -0.2 + (k ** 0.85) * 1.4;
}
/** and the inverse, so a flake can be told when the line will reach it */
const reaches = (s) => COOL + (Math.max(0, (s + 0.2) / 1.4) ** (1 / 0.85)) * RUN;

// Where the flat parts lie. `kit.at` answers 0.4 for a bare square but about
// 0.2 for a card, whose face is at ~0.21 — and the clearance is 0.055, not the
// 0.02 that looks like enough. Any closer and the plate lands on the card face
// to within a rounding error, loses the depth test (gl.LESS fails on equal)
// and is drawn on the stone AROUND the card but not on the card itself, which
// is the one place the whole motif has to appear.
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

/* ---------------------------------------------------------------- the rig */

/**
 * ONE CARD'S WORTH OF ROT: the two plates, the ash that comes off the line,
 * the plume above it, the guttering light along it, and the lamp that travels
 * with it. Everything is in the card's own frame — x across, z along the
 * sweep, y up — so the caller only has to place the group.
 *
 * `plates` is a child group of its own because the two halves follow different
 * things: the plates are painted ON the card and have to sag, sink and shrink
 * with it, while the dust has already left and must not.
 *
 * `drift` carries the dust in a world direction — the exit aims it at the
 * discard pile, the motif leaves it null and the dust simply rises. `linger`
 * stretches every life, for the exit, where the ash has to outlast the card.
 * `nOff` is where in the noise this rig reads its tearing from: handed in, two
 * rigs tear IDENTICALLY, which is what lets the exit pick a burn up from the
 * motif mid-stride without the torn edge jumping.
 */
function rotRig({ drift = null, linger = 1, nOff = null } = {}) {
  const noise = noiseTex();
  // Two uniform blocks, not one shared object: the char and the line fade on
  // different schedules, and three.js hands the same object to both materials
  // if you pass it twice — so setting the line's fade set the char's too and
  // the whole burn blinked out together at the near edge.
  const seed = nOff || new THREE.Vector2(Math.random(), Math.random());
  const charU = {
    noiseMap: { value: noise }, nOff: { value: seed }, front: { value: -0.2 },
    fade: { value: 1 }, crumble: { value: 0 },
  };
  const emberU = {
    noiseMap: { value: noise }, nOff: { value: seed }, front: { value: -0.2 },
    fade: { value: 0 }, time: { value: 0 },
  };

  const group = new THREE.Group();
  const plates = new THREE.Group();
  group.add(plates);

  const plate = (frag, uniforms, order, lift, blending) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.ShaderMaterial({
        uniforms, vertexShader: VERT, fragmentShader: frag,
        transparent: true, depthWrite: false, blending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = lift;
    m.renderOrder = order;
    plates.add(m);
  };
  plate(CHAR_FRAG, charU, 6, 0, THREE.NormalBlending);
  plate(EMBER_FRAG, emberU, 7, 0.006, THREE.AdditiveBlending);

  /* ---------------------------------------------------- what comes off it */

  // Ash is born WHERE THE LINE IS: each flake is seeded with the sweep
  // coordinate it sits at and the second the front will reach it. Spawning
  // them from one emitter in the middle was the first attempt and it read as a
  // card puffing smoke; coming off the line is what ties the two halves of the
  // motif together.
  const bits = [];
  const FLAKES = 22, MOTES = 9;
  for (let i = 0; i < FLAKES + MOTES; i++) {
    const mote = i >= FLAKES;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: mote ? lobeTex() : flakeTex(),
      color: mote ? 0x7fdfa0 : 0xa9a1b6,
      transparent: true, opacity: 0, depthWrite: false,
      blending: mote ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    // ABOVE both plates. Sprites default to renderOrder 0, so the whole ash
    // system drew before the char and was then painted over by it — every
    // flake is by definition over ground the rot has already taken, so the
    // dust was perfectly invisible for four passes of tuning it.
    s.renderOrder = 9;
    s.visible = false;
    group.add(s);
    // The last of them are a FINAL WAVE: they come off the whole card at once
    // as the line leaves it, rather than off the line. Without it the motif
    // simply stopped — the front ran off the near edge and the last thing you
    // saw was a dark rectangle doing nothing while the char dissolved. The end
    // of a thing coming apart is the part that comes apart.
    const last = i >= FLAKES + MOTES - 11;
    const sp = last ? rnd(-0.05, 0.95) : rnd(-0.05, 1.0);
    bits.push({
      s, mote, sp,
      born: last ? CROSS - 0.04 + rnd(0, 0.16) : reaches(sp),
      // pulled in from the very rim: a flake born on the edge hangs in space
      // beside the card with nothing under it
      u: rnd(0.08, 0.92),
      // Cold, so it does not SHOOT. Ash off a fire rides a thermal; ash off
      // this rides nothing and is barely lifted at all. A rise of 1.1 — what
      // the kit's own sparks use — turned it into a fountain and put the motif
      // straight back into fire's territory.
      rise: mote ? rnd(0.55, 1.0) : rnd(0.38, 0.9),
      wander: rnd(-0.34, 0.34),
      pull: drift ? rnd(1.0, 2.4) * (last ? 1.4 : 1) : 0,
      sway: rnd(0, 6.28),
      life: (mote ? rnd(0.5, 0.8) : rnd(0.5, 0.9)) * linger,
      size: mote ? rnd(0.1, 0.16) : rnd(0.16, 0.34),
      spin: rnd(-2.2, 2.2),
      lit: rnd(0.55, 1),
    });
  }

  // The PLUME. Everything else is card-sized, and a card is sixty screen
  // pixels: at the table this motif was a dark rectangle with a thin bright
  // line on it and nothing in the air at all, so from across the board you
  // could not tell a card was being destroyed. This is the only part with any
  // height to it, and it is grave-dust rather than smoke — pale, so it reads
  // against a dark brown board, and torn, so it never firms up into a ball.
  //
  // It drifts up and AWAY rather than standing over the card: a column sitting
  // on the card hid the burn that is the point of the effect.
  const PUFFS = 12;
  const puffs = [];
  for (let i = 0; i < PUFFS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex(), color: 0xb6adc2, transparent: true, opacity: 0,
      depthWrite: false,
    }));
    s.renderOrder = 10;
    s.visible = false;
    group.add(s);
    const last = i >= PUFFS - 4;
    const sp = rnd(-0.05, 0.98);
    puffs.push({
      s, sp, born: last ? CROSS - 0.02 + rnd(0, 0.14) : reaches(sp) + rnd(0, 0.05),
      u: rnd(0.1, 0.9),
      rise: rnd(0.75, 1.5),
      wander: rnd(-0.45, 0.45),
      lean: rnd(0.15, 0.5),
      pull: drift ? rnd(0.8, 1.8) : 0,
      life: rnd(0.6, 0.95) * linger,
      size: rnd(0.55, 1.15),
      spin: rnd(-0.9, 0.9),
      lit: rnd(0.55, 1),
    });
  }

  // The low guttering light riding the line: broad soft lobes that pulse where
  // the rot is working. Deliberately WIDER THAN TALL — anything tall is a
  // flame, and fire.js owns flames. At half a card wide by a sixth high they
  // read as a sheet of cold light lying on the card.
  const GUTTERS = 8;
  const gutters = [];
  for (let i = 0; i < GUTTERS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lobeTex(), color: 0x3f9c5f, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.center.set(0.5, 0.2);
    s.renderOrder = 8;
    s.visible = false;
    group.add(s);
    gutters.push({
      s, u: (i + rnd(0.15, 0.85)) / GUTTERS,
      lag: rnd(-0.07, 0.05), phase: rnd(0, 6.28),
      w: rnd(0.24, 0.44), h: rnd(0.08, 0.15),
    });
  }

  // travels with the line, low power. A point light decays with the square of
  // the distance and this one sits half a card above the face, so anything
  // near the kit's default 14 washed the card white and ate the front.
  const light = new THREE.PointLight(0x8ce0b2, 0, 3.2, 2);
  group.add(light);

  const dx = drift ? drift.x : 0;
  const dz = drift ? drift.z : 0;

  /**
   * Drive the whole rig from one number. Answers how far the burn has got.
   *
   * `plateFade` takes the film off the card face. The motif leaves it at 1 and
   * lets `hold` remove it; the exit winds it down, because the plates are
   * painted on a card that is no longer there and a card-shaped grey stain sat
   * on the empty square for most of a second after the card had gone.
   */
  function tick(sec, plateFade = 1) {
    const front = frontAt(sec);
    // The line fades in over the first breath and out as it runs off the near
    // edge — a shader front does not stop existing at 1.2, it sits glowing on
    // the last torn sliver of card.
    const lit = Math.min(1, sec / 0.16)
      * (1 - Math.min(1, Math.max(0, (front - 1.02) / 0.18)));

    charU.front.value = front;
    charU.fade.value = plateFade;
    // The ashing-over starts only once the line is off the card, so the two
    // never overlap: the film paling while the front was still eating into it
    // read as the effect failing rather than finishing.
    charU.crumble.value = Math.min(1, Math.max(0, (sec - CROSS - 0.06) / 0.34));
    emberU.front.value = front;
    emberU.time.value = sec;
    emberU.fade.value = lit * plateFade;

    for (const b of bits) {
      const u = (sec - b.born) / b.life;
      if (u <= 0 || u >= 1) { b.s.visible = false; continue; }
      b.s.visible = true;
      const climb = easeOut(u);
      // the graveward pull is on AGE and not on the eased climb: dust that is
      // being carried somewhere keeps going after it has stopped rising
      const carry = b.pull * (sec - b.born);
      b.s.position.set(
        (b.u - 0.5) * CARD_W + b.wander * climb + Math.sin(b.sway + u * 4) * 0.045
          + dx * carry,
        0.05 + b.rise * climb,
        (b.sp - 0.5) * CARD_H + Math.cos(b.sway + u * 3) * 0.035 + dz * carry,
      );
      b.s.material.rotation = b.spin * u;
      b.s.scale.setScalar(b.size * (b.mote ? 1 - u * 0.4 : 1));
      // in fast, out slow: a flake that fades in gently is invisible for the
      // half of its life spent nearest the card, which is the readable half
      b.s.material.opacity = b.lit * Math.min(1, u * 7) * (1 - u) ** 1.4
        * (b.mote ? 0.9 : 1);
    }

    for (const q of puffs) {
      const u = (sec - q.born) / q.life;
      if (u <= 0 || u >= 1) { q.s.visible = false; continue; }
      q.s.visible = true;
      const climb = easeOut(u);
      const carry = q.pull * (sec - q.born);
      q.s.position.set(
        (q.u - 0.5) * CARD_W + q.wander * climb + dx * carry,
        0.06 + q.rise * climb,
        (q.sp - 0.5) * CARD_H + q.lean * climb + dz * carry,
      );
      q.s.material.rotation = q.spin * u;
      // swells as it goes: dust that keeps its size reads as a ball on a
      // string, and the spread is most of what says this is dust at all
      q.s.scale.setScalar(q.size * (0.42 + 0.95 * climb));
      // thin, and thinning: at anything over a quarter it stopped being a veil
      // and became a grey lid over the card
      q.s.material.opacity = 0.4 * q.lit * Math.min(1, u * 4) * (1 - u) ** 1.3;
    }

    const onCard = front > -0.06 && front < 1.06;
    for (const gu of gutters) {
      gu.s.visible = onCard && lit > 0.01;
      if (!gu.s.visible) continue;
      const flick = 0.35 + 0.65 * Math.abs(Math.sin(gu.phase + sec * 6.5 + gu.u * 9));
      gu.s.position.set((gu.u - 0.5) * CARD_W, 0.03,
        (Math.min(1.02, front + gu.lag) - 0.5) * CARD_H);
      gu.s.scale.set(gu.w, gu.h * (0.5 + 0.8 * flick), 1);
      gu.s.material.opacity = 0.16 * flick * lit;
    }

    light.position.set(0, 0.62, (Math.min(1, Math.max(0, front)) - 0.5) * CARD_H);
    light.intensity = 0.7 * lit;

    return Math.min(1, Math.max(0, (sec - COOL) / RUN));
  }

  return { group, plates, tick, nOff: seed };
}

/**
 * How far the colour has gone out of the card at sweep progress `k`.
 *
 * The half the rot has NOT reached yet has to be dying too, or the motif is a
 * decal creeping over a perfectly healthy picture. And it does NOT let go at
 * the end: an earlier pass eased the grey back over the last fifth so the hold
 * would not finish on a snap, and the card spent its whole tail visibly
 * RECOVERING — a death that undoes itself.
 */
function drainedTint(out, sec, k) {
  const cool = easeOut(Math.min(1, sec / 0.22));
  const dead = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const v = 1 - cool * 0.22 - dead * 0.62;
  out.setRGB(v * 0.9, v * 0.97, v);          // and cools as it dulls
  return dead;
}

/* ------------------------------------------------------------- the motif */

export function wither(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const rig = rotRig();
  rig.group.position.copy(p).setY(flatY(p));

  // Both of these are OPTIONAL. Fratricide is a plain tactic with no card of
  // its own on the table, so `kit.piece` answers null and the motif plays on a
  // bare square; `animating` is set every tick rather than once because the
  // board's own move tween clears it, and pieces.js only leaves the front
  // material and the transform alone while it is up.
  const piece = kit.piece(at);
  const home = piece?.restingPosition?.() || null;
  const card = piece?.frontMat || null;
  const tint = new THREE.Color();

  // A mark, so the exit below can tell that THIS card is already burning.
  // Funeral Pyre resolves as a Construct and can be destroyed by its own
  // resolution, which puts the motif and the exit on the same piece: two burns
  // crossing one card in opposite places, and a `done` that hands the card
  // back to full colour halfway through it dissolving.
  const mark = { yield: false, sec: 0, nOff: rig.nOff };
  if (piece) piece.witherMark = mark;

  kit.hold(rig.group, SPAN, (t) => {
    const sec = t * SPAN;
    // The last breath is a RELEASE, not a recovery. Funeral Pyre is a
    // Construct and can still be on the table when this ends, and a card that
    // snapped from grey husk back to full colour in one frame — while the
    // fighters it had just killed were still husks — was the one seam anybody
    // would have noticed. Over 0.16s it reads as the dust blowing off it, and
    // it is far too fast to read as the card getting better.
    mark.sec = sec;
    // Handed over. The exit below has taken this card and is now painting the
    // same burn from the same place in the noise, so this rig stops painting
    // and stops touching the card — its dust is welcome to carry on.
    if (mark.yield) { rig.tick(sec, 0); return; }
    const go = Math.min(1, Math.max(0, (sec - (SPAN - 0.16)) / 0.16));
    const k = rig.tick(sec, 1 - go);
    if (!piece || !card) return;
    piece.animating = true;
    const dead = drainedTint(tint, sec, k) * (1 - go);
    tint.lerp(WHITE, go);
    card.color.copy(tint);
    if (home) {
      // it SAGS: the eaten half settles, so the far edge goes down and the
      // whole card sinks a little. Small — a card that visibly falls reads as
      // a hit, and nothing hits this one.
      piece.group.position.copy(home);
      piece.group.position.y -= dead * 0.045;
      piece.tilt.rotation.x = -dead * 0.055;
      rig.plates.position.y = -dead * 0.045;
      rig.plates.rotation.x = -dead * 0.055;
    }
  }, () => {
    if (!piece) return;
    // ...unless the exit has taken the card over, in which case it is still
    // dissolving and putting it back now is what makes it flash.
    if (mark.yield) return;
    if (piece.witherMark === mark) piece.witherMark = null;
    if (card) card.color.setScalar(1);
    if (home) piece.group.position.copy(home);
    piece.tilt.rotation.set(0, 0, 0);
    piece.animating = false;
  });
}

/* ----------------------------------------------------- what becomes of it */

/**
 * How long a card this killed must stay on the table before it leaves.
 *
 * Measured against the motif above rather than guessed: at 0.42s the rot on
 * the card that RESOLVED is a quarter of the way across and unmistakably under
 * way, so the deaths read as its consequence. Longer and the spell has
 * visibly finished before anything dies; shorter and the two start together
 * and the causation is gone.
 */
export const timing = { kill: 0.42 };

// How long the exit runs. Much longer than the card lasts, on purpose: the
// husk is gone by 1.52 and the last of its dust is still on its way to the
// pile. The number is not free — it is the longest-lived flake (a late one
// from the final wave, `linger`-stretched) plus the largest `lead` — and the
// first cut of it ended the hold while dust was still in the air, which
// deletes it mid-drift.
const EXIT = 2.5;
const WILT = 0.28;      // the stiffness starts going out of it
const HUSK = 0.90;      // the burn is over; what is left starts coming apart
const GONE = 1.52;      // the last of the card

/**
 * A card wither killed has to ROT AWAY.
 *
 * The generic death struck it flat, put a red burst under it and threw it on
 * the discard pile — so a fighter this motif had already reduced to a grey
 * husk died a second time, in a motion that knew nothing about rot, and the
 * spell read as something that had merely happened nearby.
 *
 * The same rig as the motif runs on the card, and then the husk comes apart.
 * It does NOT travel: there is nothing left of it with the substance to
 * travel, so it sags, dries in on itself and goes, and the DUST is what
 * carries to the pile — which is also the only thing here that says where the
 * card went.
 *
 * Every material it borrows is put back in `done` — colour, opacity, the
 * transparent flag, the transform — because nothing here owns those; a card
 * left grey and half transparent by an animation that ended early is a ghost
 * for as long as the piece lives.
 */
export const exit = {
  destroy(kit, piece, square, ev, done) {
    if (!piece) { done?.(); return; }

    const home = piece.restingPosition?.() || piece.group.position.clone();
    const toward = kit.grave(piece.owner).sub(home).setY(0);
    // a Stronghold sits on its own plinth directly over its graveyard, so the
    // direction can come out as nothing at all; the dust then drifts down the
    // table rather than dividing by zero and disappearing
    if (toward.lengthSq() < 1e-6) toward.set(0, 0, 1);
    toward.normalize();

    // The motif may already be burning this very card (see `witherMark`) —
    // Funeral Pyre resolves as a Construct and can be destroyed by its own
    // resolution. Starting a second burn there puts two fronts on one card
    // crossing it in different places. Instead this one TAKES THE BURN OVER:
    // it reads the same place in the noise, so the torn edge is identical, and
    // it starts its clock where the motif had got to, so the line does not
    // jump. The motif then stops painting and keeps only its dust.
    const mark = piece.witherMark || null;
    const phase = mark ? (mark.sec || 0) : 0;
    if (mark) mark.yield = true;

    const rig = rotRig({ drift: toward, linger: 1.25, nOff: mark ? mark.nOff : null });
    rig.group.position.copy(home).setY(flatY(home));

    // Funeral Pyre kills four cards in one breath and every exit is handed the
    // same clock, so without this they burn in lockstep — four identical lines
    // crossing four cards at the same instant, which reads as a screen wipe
    // rather than as four things rotting. A fifth of a second of spread is
    // enough to break it and too little to look like four separate events.
    // Not on the card the motif handed over, though: there the clock is
    // already running, and a lead would hold its front still for that long.
    const lead = mark ? 0 : rnd(0, 0.26);

    // The EDGE as well as the faces. It is a lit slab a couple of pixels deep,
    // and a bright rim round a grey husk is exactly the thing that gives away
    // that only the picture has changed.
    const edge = piece.card3d.material[0];
    const mats = [piece.frontMat, piece.backMat, edge];
    const wasClear = mats.map((m) => m.transparent);
    // The FRONT material's base is white, not whatever it happens to hold now.
    // pieces.js recomputes it from scratch every frame, and if the motif is
    // already running on this card it is holding a grey there — captured, that
    // grey would be squared on the way down and restored on the way out.
    const baseCol = mats.map((m, i) => (i === 0 ? new THREE.Color(1, 1, 1) : m.color.clone()));
    for (const m of mats) m.transparent = true;

    const tint = new THREE.Color();
    kit.hold(rig.group, EXIT, (t) => {
      const sec = Math.max(0, t * EXIT - lead) + phase;
      // the film goes with the card, a breath behind it: left running it
      // painted a card-shaped grey stain on an empty square for most of a
      // second after the card itself had gone
      const k = rig.tick(sec, 1 - Math.min(1, Math.max(0, (sec - GONE) / 0.26)));
      piece.animating = true;

      drainedTint(tint, sec, k);
      for (let i = 0; i < mats.length; i++) mats[i].color.copy(baseCol[i]).multiply(tint);

      // It DRIES IN and SETTLES rather than buckling up. fire.js lifts a corner
      // because heat curls paper; rot does the opposite — it takes the
      // stiffness out — so this one goes down. The sink is deliberately larger
      // than the shrink, because a card that only shrinks reads as being
      // pulled away from the camera rather than as falling in on itself.
      const wilt = easeIn(Math.min(1, Math.max(0, (sec - WILT) / (HUSK - WILT))));
      const apart = easeIn(Math.min(1, Math.max(0, (sec - HUSK) / (GONE - HUSK))));
      const sink = 0.05 * wilt + 0.075 * apart;
      piece.group.position.copy(home).setY(home.y - sink);
      piece.group.scale.setScalar(1 - 0.07 * wilt - 0.24 * apart);
      piece.tilt.rotation.x = -0.075 * wilt - 0.06 * apart;
      piece.tilt.rotation.z = 0.045 * wilt;
      // the plates are painted ON the card and have to go where it goes
      rig.plates.position.y = -sink;
      rig.plates.rotation.x = piece.tilt.rotation.x;
      rig.plates.rotation.z = piece.tilt.rotation.z;
      rig.plates.scale.copy(piece.group.scale);

      // and it thins out from under its own ash. The fade TRAILS the ashing
      // over by a breath, so what you watch vanish is a grey husk and not a
      // picture — faded together, the card's art was still faintly legible in
      // the last frame it existed.
      const o = 1 - apart;
      for (const m of mats) m.opacity = o;
      piece.group.visible = o > 0.004;
    }, () => {
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(baseCol[i]);
        mats[i].opacity = 1;
        mats[i].transparent = wasClear[i];
      }
      piece.group.visible = true;
      piece.group.scale.setScalar(1);
      piece.group.position.copy(home);
      piece.tilt.rotation.set(0, 0, 0);
      piece.animating = false;
      if (piece.witherMark === mark) piece.witherMark = null;
      done?.();
    });
  },
};
