// THE DECOY — a whirlwind of costume, and when it opens the villager is gone.
//
// Shared by 2 cards: M025 and M026, both "Totally Normal Villager".
//
//   "Nothing to See Here — While this fighter is in your Back Row, you may
//    Deploy IIs or IIIs on top of it. Before you do, put this fighter into
//    your hand without its stack."
//
// So the villager does NOT get covered up and stay there. It LEAVES, to its
// owner's hand, and the card you deployed lands on the square it was standing
// on. That swap IS the card: a masked carnival figure vanishing in a swirl of
// its own costume and somebody else standing there instead. The joke in the
// name survives it — the one totally normal villager on the quay turns out to
// be a conjuring trick.
//
// WHAT IT IS: the stone under the fighter goes dark, six ribbons of cloth come
// up out of it and wind tighter and tighter, and at the moment they are
// tightest a disc of spinning cloth shuts over the square completely. It is
// shut for a quarter of a second — long enough to swallow the card, not long
// enough to be a curtain — and then it is whipped off outward and the square
// is clean. Timing is the whole trick; the particle count is not.
//
// THE COLOURS ARE THE CARD'S OWN, off untitled-card-3.png: the deep crimson of
// the costume, the purple of the sleeves and hood, and the light blue of the
// canal and of the card's own title. They are kept APART — one colour per
// ribbon, and the six arms painted into the cover alternate so two of the same
// never lie next to each other. Nothing here is additive. Three saturated
// colours on additive blending sum past 1.0 in all three channels under ACES
// and photograph as one grey-white smear, which is exactly the trap a
// three-colour whirlwind walks into. Contrast is bought with the dark skirt
// underneath instead, and the arms carry a bright edge on their leading side.
//
// WHAT IT IS NOT: the Void pit out to the left, which is also a spinning thing
// with purple and blue arms. That one is a HOLE — flat black mouth, broken
// ground, additive swirl sunk into the dirt. This is cloth: it stands ABOVE
// the stone, it is crimson before it is anything else, it lasts a second and a
// half, and it leaves scraps rather than a pit.
//
// WHY IT IS NOT ON THE CARD'S FACE. The first build tipped the card up on its
// far edge like a bin lid to show what was underneath, and it cannot work:
// this camera's elevation is fixed at 52 degrees, so the underside of a card
// is only visible once the card is tipped past 52 degrees — at the quarter of
// a radian that still reads as a card lying on a table you see MORE of the
// face and none of the gap. That failure is still true and still worth
// knowing; it is why the concealment here is a disc SEEN FROM ABOVE and not a
// wall seen from the side. Height costs about 26 screen pixels per world unit
// at this camera and width costs nothing, so the ribbons are only there to
// give the disc volume and stop it reading as a painted circle.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=560" \
//             --eval tools/fxdemo/decoy.js --out /tmp/decoy-560.png \
//             --wait 10000 --settle 600
// ?t is milliseconds INTO the motif, ?me is the square (a Back Row one, which
// is the only place the rule works), ?zoom drops the camera in, and ?solo=1
// leaves the villager standing instead of swapping it — the case where the
// rule was not used and nothing has to leave.

import { THREE, CARD_W, CARD_H } from '../kit.js';

const TAU = Math.PI * 2;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------------ time */

// Every moment here is in SECONDS from the first frame, NOT a fraction of
// SPAN, because `timing.kill` and the card's own leaving are in seconds too
// and all three have to be read against each other. Get that wrong and the
// card is gone before the cloth has closed over it, which is the bug the Fire
// Bolt was pulled up on.
const SPAN = 1.55;
const SHUT = 0.42;      // the cover is total from here...
const OPEN = 0.70;      // ...until here, and then it is thrown off
const CLEAR = 0.88;     // and there is nothing over the square at all

/* ---------------------------------------------------------------- colour */

// Read off the card. Marvorren's kit colour is a pale cyan and it is NOT what
// this card looks like — the villager is crimson first, and a generic faction
// wash would have thrown away the only thing that makes this motif hers.
//
// The light blue is pushed further toward cyan and brighter than the printing.
// ACES pulls roughly a third of green into red, so a polite sky blue arrives
// on screen as grey; at 0x5ec9ee it is still plainly blue next to the purple.
const COL = [
  { cloth: '#c4133c', lit: '#ff5d7e', hex: 0xc4133c },   // the costume
  { cloth: '#5ec9ee', lit: '#b6ecff', hex: 0x5ec9ee },   // the canal, the title
  { cloth: '#7d3fc0', lit: '#bb8bee', hex: 0x7d3fc0 },   // the sleeves
];

/* -------------------------------------------------------------- geometry */

// How big the cover has to be to actually hide a card. A card is 1.74 x 1.76,
// so its own corner is 1.237 from the middle, and the cover's texture is
// solid out to OPAQUE of its radius and feathered past that — a feathered edge
// lying over a card corner is a card corner you can still see. Sized from the
// card rather than typed in, because the two must not drift.
//
// 0.86, not the 0.80 this started at. At 0.80 the disc came out 3.1 across
// against a 2.5 flagstone, and the rule this card lives by only works in the
// BACK ROW — so the square is always on the edge of the board, and three tenths
// of overhang landed on the wooden rail and the Stronghold plinth behind it.
// Photographed, the whirlwind looked like it was standing on the furniture.
// At 0.86 it is 2.88 across: still proud of its stone, still nowhere near the
// neighbouring CARD, which starts 1.75 out.
const OPAQUE = 0.86;
const COVER = (Math.hypot(CARD_W, CARD_H) / 2) / OPAQUE;

// Anything flat over a card sits 0.055 above its face. A card's face is at
// 0.2205 (resting 0.203 plus half the slab) and the flagstone at 0.080; at
// less clearance the depth test drops the decal onto the stone AROUND the card
// and not onto the card, which at this camera is a centimetre the depth buffer
// cannot separate.
const COVER_Y = 0.28;
const GROUND_Y = 0.135;

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map, so a canvas built per cast leaks a GPU upload every
// time a villager is played.
const TEX = new Map();
function tex(key, paint, w, h) {
  let t = TEX.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEX.set(key, t);
  }
  return t;
}

/**
 * A soft round brush.
 *
 * The arms were first drawn as hard arcs under a canvas blur filter, and a
 * canvas filter costs a full-surface pass PER DRAW — six arms of forty-eight
 * dabs each is five hundred and seventy-six of them, and the first cast of the
 * effect stalled the frame. A pre-built gradient dab drawn with drawImage is
 * the same softness for nothing.
 */
const BRUSH = new Map();
function brush(css) {
  let c = BRUSH.get(css);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = css;
    g.globalAlpha = 1;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, css);
    grd.addColorStop(0.45, css);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    BRUSH.set(css, c);
  }
  return c;
}

/**
 * THE COVER: a disc of spinning cloth, dark underneath and coloured on top.
 *
 * Solid out to OPAQUE of the radius so it genuinely hides what is under it,
 * feathered past that so it is not a cut circle lying on the stone.
 *
 * Six arms, and their ORDER matters more than their number: crimson, blue,
 * purple, crimson, blue, purple. Painted as three wide arms of one colour each
 * they overlapped at the hub and the middle of the disc went muddy; alternated
 * round the circle no two of the same colour ever touch, and the hub is dark
 * cloth rather than a mixture of all three.
 *
 * THREE THINGS THE FIRST CUT GOT WRONG, all of them only visible zoomed in:
 *
 *  - The body of the disc was near black (11,4,14) and the arms were thin, so
 *    what landed on the stone was a BLACK HOLE WITH NEON PIPING — which is the
 *    Void pit, ten feet to the left. The dark is now wine rather than black,
 *    and each arm is laid down as a wide soft WASH first, so most of the disc
 *    is coloured cloth and only the eye of it is dark.
 *  - Forty-eight dabs along an arm left the dabs VISIBLE. A soft brush spaced
 *    wider than its own radius is a string of beads, and the cyan arm in
 *    particular read as a coiled spring.
 *  - The bright edge at half alpha in near-white turned every arm into a tube
 *    of light. It is a fold catching a torch, not a filament: a third of that,
 *    and in the colour's own family rather than toward white.
 */
const coverTex = () => tex('cover', (g, W) => {
  const c = W / 2;
  g.clearRect(0, 0, W, W);

  // DARK FIRST. On a dark board under ACES a bright disc is a lamp; a dark
  // disc with bright folds on it is a thing made of cloth. It is also what
  // actually does the hiding — the arms are too thin to cover a card on
  // their own and always were.
  const base = g.createRadialGradient(c, c, 0, c, c, c);
  base.addColorStop(0, 'rgba(38,12,32,1)');
  base.addColorStop(0.55, 'rgba(40,13,33,1)');
  base.addColorStop(OPAQUE, 'rgba(37,12,31,1)');
  base.addColorStop(1, 'rgba(37,12,31,0)');
  g.fillStyle = base;
  g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();

  const dab = (css, x, y, r, a) => {
    g.globalAlpha = a;
    g.drawImage(brush(css), x - r, y - r, r * 2, r * 2);
  };

  // Three passes over the same six paths: the wash that gives the disc its
  // colour, the fold that gives it an edge, and the light on the fold. Drawn
  // arm-by-arm instead the wash of one arm painted over the fold of the last.
  for (const pass of [0, 1, 2]) {
    for (let i = 0; i < 6; i++) {
      const col = COL[i % 3];
      const a0 = (i / 6) * TAU;
      for (let k = 0; k < 130; k++) {
        const u = k / 129;
        const r = c * (0.06 + 0.92 * u);
        const a = a0 + u * 2.15;           // how far the arm wraps: two thirds
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        // Narrow at the hub and wide at the rim, then thinning again in the
        // last fifth so the arms end in points instead of stopping dead.
        const w = c * 0.10 * (0.28 + 0.72 * u) * (1 - 0.6 * clamp01((u - 0.80) / 0.20));
        // Alphas look absurdly low because they are not one dab's worth: a
        // hundred and thirty soft dabs along an arm overlap about fourteen
        // deep, so 0.16 a dab is a solid fold and 0.025 is a wash you can see
        // the wine through.
        if (pass === 0) dab(col.cloth, x, y, w * 2.6, 0.025);
        else if (pass === 1) dab(col.cloth, x, y, w, 0.16);
        else {
          dab(col.lit, x + Math.cos(a + Math.PI / 2) * w * 0.55,
            y + Math.sin(a + Math.PI / 2) * w * 0.55, w * 0.42, 0.055 * u);
        }
      }
    }
  }
  g.globalAlpha = 1;

  // Feather the rim, and ONLY the rim.
  g.globalCompositeOperation = 'destination-in';
  const f = g.createRadialGradient(c, c, c * OPAQUE, c, c, c);
  f.addColorStop(0, 'rgba(0,0,0,1)');
  f.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = f;
  g.fillRect(0, 0, W, W);
}, 256, 256);

/**
 * THE SKIRT: the stone going dark under the whirlwind.
 *
 * Nothing in this motif glows enough to read on its own against lit flagstone,
 * and turning anything up far enough to try takes it straight to white under
 * ACES. Darkening the ground first is what buys the contrast, and it is also
 * the only part of the effect that says the wind is touching the floor.
 */
const skirtTex = () => tex('skirt', (g, W) => {
  const c = W / 2;
  // THE DARK IS PUT WHERE IT CAN BE SEEN. A plain blot darkest in the middle
  // does nothing at all here: the middle of it is under the cover, which is
  // opaque, so the only part of the skirt that ever reaches the camera is its
  // outer third. The band is therefore pushed out to 0.4-0.75 of the radius,
  // which is the stone immediately around the cover's rim.
  const grd = g.createRadialGradient(c, c, 0, c, c, c);
  grd.addColorStop(0, 'rgba(12,4,14,0.55)');
  grd.addColorStop(0.40, 'rgba(11,4,13,0.86)');
  grd.addColorStop(0.64, 'rgba(15,5,18,0.72)');
  grd.addColorStop(0.84, 'rgba(46,12,34,0.26)');
  grd.addColorStop(1, 'rgba(46,12,34,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
}, 128, 128);

/** A torn fleck of cloth. Not round: a round one is a spark. */
const scrapTex = () => tex('scrap', (g, W) => {
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(W * 0.06, W * 0.34);
  g.lineTo(W * 0.62, W * 0.08);
  g.lineTo(W * 0.95, W * 0.48);
  g.lineTo(W * 0.72, W * 0.94);
  g.lineTo(W * 0.24, W * 0.78);
  g.closePath();
  g.fill();
  // one soft edge, so it is a rag and not a shard
  const grd = g.createLinearGradient(0, 0, W, W);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.7, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
}, 64, 64);

/* ------------------------------------------------------------------ bits */

/** A flat decal lying face up. */
function plate(map, size, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, opacity: 0,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  return m;
}

/** A fleck of costume, thrown off. Sprites, so they face the camera. */
function scrap(hex) {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: scrapTex(), color: hex, transparent: true, depthWrite: false, opacity: 0,
    // NOT additive. A handful of coloured flecks crossing each other over a
    // lit flagstone on additive blending is a white cloud, every time.
  }));
}

/* ------------------------------------------------------------------ main */

export function decoy(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  // The whirlwind belongs to the SQUARE, not to the card — the card is the one
  // thing in this that is about to leave. Pinned to the villager it would have
  // followed him off the board and taken the reveal with it.
  whirl(kit, p.x, p.z);
}

function whirl(kit, cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);

  const skirt = plate(skirtTex(), 4.6, GROUND_Y);
  // Named so tools/fxdemo/decoy.js can print what is actually on screen and
  // how strongly. Every part of this is a decal a few dozen pixels across, and
  // at that size "faint" and "never faded up" are the same picture.
  skirt.name = 'decoy-skirt';
  skirt.renderOrder = 2;
  g.add(skirt);

  const cover = plate(coverTex(), COVER * 2, COVER_Y);
  cover.name = 'decoy-cover';
  cover.renderOrder = 7;
  g.add(cover);

  // The ribbons. Six, two of each colour, evenly spaced so the colours go
  // round in order and never double up on one side of the column.
  const SEG = 30;
  const ribs = [];
  for (let i = 0; i < 6; i++) {
    const col = COL[i % 3];
    // emissive WELL under 1. A standard material's emissive goes through ACES,
    // and this arena is dark enough that the temptation is to crank it — at
    // 1.8 the crimson ribbon tone-mapped to a white streak and the three
    // colours became one. At 0.85 and 0.30 wide they were still flat coloured
    // blades, like cut paper; at 0.5 and 0.22 they take the board's own light
    // and read as cloth.
    const st = kit.strip({ segments: SEG, width: 0.22, colour: col.hex, emissive: 0.5 });
    // DARK BODY, coloured emissive. Left at its own colour the light blue
    // ribbon stood in the lamp below it and tone-mapped to a white streak —
    // three colours of cloth and one of them arriving as paper. Lit by a
    // quarter of itself it keeps its hue whatever is shining on it, which is
    // the same trick the Arcane shards use.
    st.mat.color.setHex(col.hex).multiplyScalar(0.28);
    // No shadows. Six thin ribbons turning over a spotlit square striped the
    // card underneath, and the stripes moved — during the reveal, which is the
    // one moment that has to be clean.
    st.mesh.castShadow = false;
    st.mesh.name = 'decoy-rib';
    st.mat.depthWrite = false;
    g.add(st.mesh);
    ribs.push({
      st,
      phase: (i / 6) * TAU,
      pts: Array.from({ length: SEG }, () => new THREE.Vector3()),
      // each ribbon leans and wobbles on its own, or six identical helices
      // read as a drawn spring rather than as cloth
      lean: 0.85 + (i % 3) * 0.12,
      wob: 4.5 + i * 0.7,
    });
  }

  // Scraps of costume, thrown clear when it opens. They are the only thing
  // left on the square afterwards and they are gone inside a second.
  const scraps = [];
  for (let i = 0; i < 8; i++) {
    const s = scrap(COL[i % 3].hex);
    s.name = 'decoy-scrap';
    // 0.38, not 0.3: a world unit is about 26 screen pixels at this camera, so
    // a 0.3 fleck is eight pixels and a sub-pixel detail is an absent one.
    s.scale.setScalar(0.38);
    s.visible = false;
    g.add(s);
    const a = (i / 8) * TAU + Math.random() * 0.5;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    scraps.push({
      s,
      // THROWN OFF THE COVER'S RIM, not out of the middle of the square.
      // Launched from the centre they spent the first fifth of a second
      // sitting on the newly revealed card's face — a handful of pink blobs
      // stuck to the new fighter at exactly the moment that has to be clean.
      home: dir.clone().multiplyScalar(COVER * 0.85).setY(0.62),
      // outward and up, and a different speed each so they do not arrive as a
      // ring — a ring on the ground is every other effect in this game
      vel: dir.clone().multiplyScalar(2.2 + Math.random() * 1.6)
        .setY(1.5 + Math.random() * 1.1),
      spin: (Math.random() - 0.5) * 9,
    });
  }

  // One light, inside the column, so the flagstone and the fighter's own edges
  // take the colour while it is shut. The arena is dark now and this is cheap
  // prominence — but it is deep and it is brief: a bright lamp on the square
  // would wash the cover's arms out to the same white the additive blending
  // was avoided for.
  const lamp = new THREE.PointLight(0x9c2a6e, 0, 5.2, 2);
  lamp.position.y = 0.75;
  g.add(lamp);

  // The angle is ACCUMULATED rather than computed from the clock, because the
  // spin has to be slow while it gathers and fast while it is shut, and
  // integrating that by hand each frame is one line against a closed form that
  // nobody can read.
  let ang = 0;
  let last = 0;

  kit.hold(g, SPAN, (t) => {
    const s = t * SPAN;

    const grow = smooth(s / 0.26);                        // up out of the stone
    const tight = smooth((s - 0.14) / (SHUT - 0.14));     // drawn in
    const fling = smooth((s - OPEN) / (CLEAR - OPEN));    // thrown off

    ang += (2.4 + 12 * tight * (1 - 0.7 * fling)) * Math.max(0, s - last);
    last = s;

    // THE COVER. Up over a quarter of a second, shut and unchanging for
    // another quarter, then whipped off in a tenth. The fall is much faster
    // than the rise on purpose: something closing over a card is a curtain
    // and something coming off it is a conjuror's hand.
    const shut = smooth((s - 0.16) / (SHUT - 0.16));
    const gone = smooth((s - OPEN) / 0.12);
    cover.material.opacity = shut * (1 - gone);
    cover.scale.setScalar((0.40 + 0.60 * shut) * (1 + 0.55 * fling));
    cover.rotation.z = -ang * 0.9;

    // THE SKIRT: on early, because the ground going dark is the first warning
    // anything is happening; off late, after the square is clear.
    skirt.material.opacity = 0.60 * smooth(s / 0.22) * (1 - smooth((s - CLEAR) / 0.42));
    skirt.scale.setScalar(0.58 + 0.34 * grow + 0.20 * fling);
    // It does not spin. The skirt's texture is a plain radial gradient, so
    // turning it is a matrix update nobody can see — and it was turning the
    // OTHER WAY to the cover, which is the one thing that would have shown.

    // THE RIBBONS. Wide and low while it gathers, tight and tall while it is
    // shut, thrown out and UP when it opens.
    // 1.95 out, not the 2.7 it started at. Flung that far the six ribbons
    // made a ring six units across, over the neighbouring squares and up
    // against an enemy card two rows away — a flourish for one back-row
    // fighter that had taken over the whole board.
    const rad = (1.85 - 0.97 * tight) * (1 - fling) + 1.95 * fling;
    // UP as they go out, not down. Flattened on the fling they laid straight
    // across the card that had just been revealed, which is the one frame
    // that has to be clean — a reveal with a crimson streamer over the new
    // fighter's face reads as the effect not being finished with it.
    const hgt = (0.30 + 1.00 * grow) * (1 + 0.30 * fling);
    // Gone within a fifth of a second of the cover. They are the same gesture
    // and they have to end as one: held on afterwards they were a pale ring
    // still turning over a square that had already been revealed.
    const alpha = smooth(s / 0.14) * (1 - smooth((s - OPEN - 0.02) / 0.20));
    for (const r of ribs) {
      for (let j = 0; j < SEG; j++) {
        const u = j / (SEG - 1);
        const a = r.phase + ang + u * 2.4 * r.lean;
        // The taper is UNWOUND as it opens. A ribbon narrowing toward its top
        // is a column while it is shut; kept that way on the fling its top end
        // stayed over the middle of the square and swept the card's face while
        // the bottom end flew off. At full fling every point of it is out at
        // the same radius, so the whole ribbon leaves together.
        const rr = rad * (1 - 0.40 * u * (1 - fling));
        r.pts[j].set(
          Math.cos(a) * rr,
          // never below 0.16: the ground is an opaque unbroken plane and a
          // ribbon that dips under it simply stops existing
          0.16 + u * hgt + Math.sin(u * r.wob + s * 7) * 0.045,
          Math.sin(a) * rr,
        );
      }
      r.st.lay(r.pts, { taper: 0.62, twist: s * 3 + r.phase });
      r.st.mat.opacity = alpha;
    }

    // THE LAMP, only while it is shut.
    // 6, not the 9 it started at: at 9 the pale flagstones inside the cone
    // went pink and the whole square read as lit rather than as shadowed with
    // something coloured standing in it.
    lamp.intensity = 6 * smooth((s - 0.2) / 0.22) * (1 - smooth((s - OPEN) / 0.2));

    // THE SCRAPS, only after it opens.
    const age = s - OPEN;
    for (const k of scraps) {
      if (age <= 0) continue;
      k.s.visible = true;
      k.s.position.copy(k.home).addScaledVector(k.vel, age);
      // clamped for the same reason as the ribbons — a fleck that falls
      // through the floor reads as a fleck that was deleted
      k.s.position.y = Math.max(0.16, k.home.y + k.vel.y * age - 3.4 * age * age);
      k.s.material.rotation = k.spin * age;
      k.s.material.opacity = 0.9 * (1 - clamp01(age / 0.6) ** 1.4);
    }
  });
}

/* ------------------------------------------------------- what becomes of it */

/**
 * How long the villager must stay on the board: until the cover is TOTAL.
 *
 * SHUT is 0.42 and this is 0.46, so the card starts leaving four hundredths
 * after the cloth has shut over it and is finished at 0.66, four hundredths
 * before it opens again at 0.70. Every one of those numbers is in the same
 * clock as the tick above. Without a declared wait the engine — which resolves
 * instantly — takes the card off the board on the first frame, and the
 * whirlwind then closes over an empty square and opens on the same empty
 * square, which is no trick at all.
 */
export const timing = { kill: 0.46 };

const CARD = 0.20;      // and 0.46 + 0.20 = 0.66, which is inside the cover

export const exit = {
  /**
   * THE VILLAGER IS TAKEN BY THE WHIRLWIND.
   *
   * The generic return to hand shrinks the intact card and flies it off the
   * near edge of the table in an arc. Under a shut cover that arc is invisible
   * for its first half and then reappears out in the open beyond the disc,
   * which reads as the card SLIDING OUT FROM UNDER the effect — the thing the
   * motif is meant to hide. So the card does not travel at all: it turns on
   * the column's own axis, goes the colour of the cloth, and is eaten, all of
   * it in the dark under the disc.
   *
   * What says where it went is three flecks of costume flicked out toward the
   * owner's end as the cover comes off, which is the only part of this the
   * player ever actually sees leave.
   */
  hand(kit, piece, square, ev, done) {
    const at = piece.group.position.clone();
    const yaw = piece.card3d.rotation.y;
    piece.animating = true;

    // EVERY material, not just the face. The edge and the back are their own
    // opaque materials and fading the face alone leaves a dark rectangle lying
    // on the stone — a fighter dissolving into a coaster.
    const mats = [...new Set([].concat(piece.card3d.material))];
    const base = mats.map((m) => [m.color.clone(), m.opacity, m.transparent]);
    for (const m of mats) m.transparent = true;
    const CLOTH = new THREE.Color(0x3a0f2c);

    // The flecks leave as the cover does, not with the card — thrown out of a
    // shut whirlwind they would be three things crossing an opaque disc.
    kit.after(Math.max(0.01, OPEN - timing.kill), () => toss(kit, at, piece.owner));

    kit.anim.add(CARD, (t) => {
      // DOWN, and barely tilted. The first cut leaned the card 0.5 of a
      // radian as it went, and a card 1.74 wide leaned that far lifts its
      // near edge 0.09 — straight through a cover sitting 0.06 above its
      // face. Photographed at 560ms a wedge of the villager's own portrait
      // was showing through the middle of the whirlwind, which is the one
      // thing this motif exists to prevent. The lean is now small enough that
      // the sink always beats it, and the sink is what sells being swallowed
      // anyway: the column's mouth is the square.
      const e = t * t;
      piece.group.position.set(at.x, at.y - 0.16 * e, at.z);
      piece.card3d.rotation.y = yaw + 5.2 * e;
      piece.tilt.rotation.x = 0.14 * e;
      piece.tilt.rotation.z = -0.16 * e;
      piece.group.scale.setScalar(1 - 0.72 * e);
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i][0]).lerp(CLOTH, Math.min(1, t * 1.6));
        mats[i].opacity = base[i][1] * (1 - smooth(t / 0.9));
      }
    }, () => {
      // Restore everything borrowed. Pieces are POOLED: a card that came back
      // from the pool a third of its size, plum coloured and half transparent
      // is a ghost on somebody else's turn.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i][0]);
        mats[i].opacity = base[i][1];
        mats[i].transparent = base[i][2];
      }
      piece.group.position.copy(at);
      piece.group.scale.setScalar(1);
      piece.tilt.rotation.set(0, 0, 0);
      piece.card3d.rotation.y = yaw;
      piece.animating = false;
      done?.();
    });
  },
};

/**
 * Three flecks of costume thrown toward the owner's end.
 *
 * WHERE THEY LAND. kit.hand(owner) is where a returning card goes, but that
 * point is off the table out on the grass, and this arena has trees and
 * boulders standing between the camera and that patch — ./bounce.js pays for
 * the same lesson in its own comments, where an arrival photographed over lit
 * foliage came out as a smudge. These stop on the dark apron just inside the
 * player's own end, and on the LEFT of it, because the right of that end is
 * where the discard pile stands and something drifting toward the graveyard is
 * telling the wrong story.
 */
function toss(kit, from, owner) {
  const h = kit.hand(owner);
  const to = new THREE.Vector3(-h.x * 0.9, 0.9, h.z * 0.72);
  const grp = new THREE.Group();
  const bits = [];
  for (let i = 0; i < 3; i++) {
    const s = scrap(COL[i].hex);
    s.name = 'decoy-fleck';
    // Half as big again as the scraps thrown off the square, because these
    // have to cross the dark apron and be read against grass and torchlight
    // rather than against a flagstone. At 0.34 they were nine screen pixels
    // and photographed as dirt on the lens.
    s.scale.setScalar(0.52);
    grp.add(s);
    bits.push({ s, lag: i * 0.06, side: (i - 1) * 0.55, spin: (Math.random() - 0.5) * 7 });
  }
  kit.hold(grp, 0.7, (t) => {
    for (const b of bits) {
      const u = clamp01((t - b.lag) / (1 - b.lag));
      b.s.position.lerpVectors(from, to, u);
      b.s.position.x += b.side * Math.sin(u * Math.PI);
      b.s.position.y += Math.sin(u * Math.PI) * 0.6;
      b.s.material.rotation = b.spin * u;
      b.s.material.opacity = 0.95 * smooth(u / 0.12) * (1 - smooth((u - 0.6) / 0.4));
      b.s.scale.setScalar(0.52 * (1 - 0.35 * u));
    }
  });
}
