// THE DEAD GET UP — the stone cracks, a grave-mouth opens on the square, and a
// hand comes up out of it.
//
// Shared by 5 cards: C084, C087, C110, A068, R072 — Necromancer, Echoing
// Specter, Soul Swap, The Living Dead, Shallow Grave. Every one of them takes
// a fighter OUT OF THE GRAVEYARD and stands it on a square, so the picture is
// always the same: a hole opens where the card is, something climbs out of it,
// and the ground closes again.
//
// These are rare cards, and this has to look like one. The Gloaming flourish
// (cast-gloaming.js) fires on nearly every card of the faction and is dust
// SINKING into a card the light has gone out of: soft-edged, quiet, three
// quarters of a second. Everything here is its opposite on purpose — a hard
// cracked edge instead of a soft pool, dust going UP instead of down, a column
// of it standing clear of the square, and a solid object crossing the card
// face, which no flourish on this table ever does. Nothing rises in
// cast-gloaming and nothing here falls except the grit thrown out of the hole.
//
// One effect, one file.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=560" \
//             --eval tools/fxdemo/raise.js --out /tmp/r.png --settle 700
// `t` is the point in the MOTIF to freeze at, in milliseconds. The harness
// explains why wall-clock --settle cannot be trusted to land on a moment.

import { THREE, CARD_W, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';

/** The beat, in seconds — phase boundaries, not durations. */
const T = {
  CRACK: 0.16,    // a violet seam scribes itself across the card
  OPEN: 0.38,     // the seam parts into a mouth; cold light wells up it
  BREACH: 0.52,   // fingers break the plane — ring, flash, grit
  CREST: 0.80,    // full reach, held, trembling
  SINK: 1.00,     // the arm is drawn back down into the dark
  GONE: 1.22,     // nothing left above the stone
  SHUT: 1.48,     // the mouth knits to a seam and the light dies
};
const SPAN = T.SHUT;

// A card is about 63 SCREEN PIXELS wide from the game's camera — roughly 36
// pixels to the world unit — and that one number decides every size here.
const HOLE_QUAD = CARD_W * 0.88;   // the mouth, painted to 0.36 of its canvas
const CRACK_QUAD = CARD_W * 1.04;  // the seams, out to the card's own edge

/**
 * Where the flat parts lie. `kit.at` answers 0.4 for a bare square but about
 * 0.19 for a card whose face is at ~0.21, so the raw height either floats
 * above an empty square or sinks into an occupied one.
 *
 * The clearance is 0.055. At 0.03 the mouth lands ON the card face to within
 * a rounding error, loses the depth test (gl.LESS fails on equal) and draws on
 * the stone AROUND the card but not on the card itself — which is the one
 * place this motif has to be dark.
 */
const flatY = (p, onCard) => (onCard ? Math.min(p.y, 0.225) + 0.055 : 0.105);

/* -------------------------------------------------------- the torn edge */

// One ragged outline, shared by the black fill and the lit lip so they are the
// same tear. Three frequencies: a lobed overall shape, a chipped middle, and a
// fine crumble. A plain circle read as a drain-hole — the thing this must not
// be mistaken for is the faction's soft pool.
const edge = (a) => 1 + 0.10 * Math.sin(a * 3.1 + 0.7)
                      + 0.055 * Math.sin(a * 6.7 + 2.2)
                      + 0.028 * Math.sin(a * 11.3 + 4.1);

function tear(g, r) {
  g.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const d = r * edge(a);
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * d, Math.sin(a) * d);
  }
  g.closePath();
}

const canvas256 = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  return g;
};
const texOf = (src) => {
  const t = new THREE.CanvasTexture(src.canvas || src);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/**
 * The mouth: a hole with a floor you cannot see into.
 *
 * It is NORMAL-blended near-black, not a dark tint. A dark effect on a dark
 * board is invisible, and the answer is never a brighter purple — it is to
 * bring the dark yourself, so that everything else in the motif is a cold
 * thing against black rather than a cold thing against lit card art. The
 * violet only creeps in at the rim, where the hole is shallow.
 *
 * It is also what CLIPS the hand: an opaque hand drawn in the opaque pass,
 * this quad drawn after it with depthWrite off, and the depth test does the
 * rest — everything below the plane is covered, everything above it shows. An
 * earlier version faded the hand in and out by hand and it read as a decal
 * switched on, not as an arm coming through a hole.
 *
 * Kept for the life of the page: kit.hold disposes materials but never maps.
 */
let HOLE = null;
function holeTexture() {
  if (HOLE) return HOLE;
  const g = canvas256();
  const R = 0.36 * 256;
  // a blurred copy first, so the hole has a skirt of shadow on the card
  // instead of a cut edge — stone that has broken, not a punched disc
  g.shadowColor = 'rgba(6,2,16,0.85)';
  g.shadowBlur = 22;
  g.fillStyle = 'rgba(6,2,16,0.75)';
  tear(g, R * 0.97); g.fill(); g.fill();
  g.shadowBlur = 0;
  // then the crisp fill, deep in the middle and violet where it is thin
  g.save();
  tear(g, R); g.clip();
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.08);
  grd.addColorStop(0.00, 'rgba(2,0,6,0.99)');
  grd.addColorStop(0.58, 'rgba(5,1,13,0.98)');
  grd.addColorStop(0.82, 'rgba(15,5,36,0.96)');
  grd.addColorStop(1.00, 'rgba(30,11,66,0.90)');
  g.fillStyle = grd;
  g.fillRect(-128, -128, 256, 256);
  g.restore();
  HOLE = texOf(g);
  return HOLE;
}

/**
 * The lit lip. Additive, and deliberately THIN: a heavy glowing annulus at
 * forty-odd pixels fills in and becomes a violet blob with no hole in it,
 * which is the failure this motif kept coming back to. A wide faint bloom
 * under a narrow bright line is what reads as an edge catching light.
 */
let LIP = null;
function lipTexture() {
  if (LIP) return LIP;
  const g = canvas256();
  const R = 0.36 * 256;
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(128,78,235,0.8)';
  g.shadowBlur = 15;
  g.strokeStyle = 'rgba(112,64,214,0.55)';
  g.lineWidth = 7;
  tear(g, R); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(196,164,255,0.95)';
  g.lineWidth = 2.6;
  tear(g, R); g.stroke();
  LIP = texOf(g);
  return LIP;
}

/**
 * The seams, drawn in two layers for the same reason a brand is: a bright
 * hairline over card art is invisible whatever colour it is, and a black
 * keyline either side of it is what makes line-art read on a busy ground.
 * `dark` is the split in the stone, `lit` is the light coming up it.
 */
let CRACKS = null;
function crackTextures() {
  if (CRACKS) return CRACKS;
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  // laid out once and drawn twice, so the two layers are the same fracture
  const lines = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 + rnd() * 0.35;
    const run = (0.26 + rnd() * 0.15) * 256;
    const pts = [];
    // from the rim of the mouth out toward the card's edge. Started at 0.30
    // they only ever crossed the card's own border and frame, where a violet
    // line is lost; the art in the middle is where a crack can be seen.
    let a = a0, r = 0.19 * 256;
    for (let k = 0; k <= 5; k++) {
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      a += (rnd() - 0.5) * 0.5;
      r += run / 5;
    }
    lines.push(pts);
    // one branch off most of them — perfectly radial spokes read as a sun,
    // and this has to read as stone giving way
    if (rnd() < 0.7) {
      const at = 2 + Math.floor(rnd() * 2);
      const b = [pts[at]];
      let ba = a0 + (rnd() - 0.5) * 1.5, br = Math.hypot(pts[at][0], pts[at][1]);
      for (let k = 0; k < 3; k++) {
        br += run / 7;
        ba += (rnd() - 0.5) * 0.5;
        b.push([Math.cos(ba) * br, Math.sin(ba) * br]);
      }
      lines.push(b);
    }
  }
  const draw = (g, w, style, blur) => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = style;
    if (blur) { g.shadowColor = style; g.shadowBlur = blur; }
    for (const pts of lines) {
      g.lineWidth = w * (pts.length > 4 ? 1 : 0.6);
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    }
  };
  const d = canvas256();
  draw(d, 8.5, 'rgba(7,2,16,0.94)', 0);
  const l = canvas256();
  draw(l, 5.5, 'rgba(126,74,228,0.55)', 11);
  l.shadowBlur = 0;
  draw(l, 2.4, 'rgba(210,182,255,0.97)', 0);
  CRACKS = { dark: texOf(d), lit: texOf(l) };
  return CRACKS;
}

/**
 * Grave-dust going UP, drawn as a comet with its head at the TOP.
 *
 * Sprites cannot be turned to face the way they are going, so a round blob
 * stretched tall is a capsule — bright end to end, and which way it is
 * travelling is readable only by watching it move. Baking the direction into
 * the picture means one frozen frame already says UPWARD, and upward is the
 * entire motif. cast-gloaming bakes the same trick the other way up; that they
 * are mirror images of each other is the point.
 */
let RISE = null;
function riseTexture() {
  if (RISE) return RISE;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  // Held off pale lilac on purpose. Additive blending plus this arena's
  // filmic tone mapping drive any pale colour to white, and a white version
  // of this came out as pink scratches with no faction in them. Red down,
  // blue up, is what reads as COLD.
  const up = g.createLinearGradient(0, 0, 0, 128);
  up.addColorStop(0.00, 'rgba(198,166,255,0)');
  up.addColorStop(0.10, 'rgba(198,166,255,0.96)');
  up.addColorStop(0.30, 'rgba(150,104,250,0.74)');
  up.addColorStop(0.62, 'rgba(104,58,222,0.32)');
  up.addColorStop(1.00, 'rgba(62,26,160,0)');
  g.fillStyle = up;
  g.fillRect(0, 0, 64, 128);
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.24, 'rgba(0,0,0,0.45)');
  across.addColorStop(0.50, 'rgba(0,0,0,1)');
  across.addColorStop(0.76, 'rgba(0,0,0,0.45)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, 64, 128);
  RISE = texOf(c);
  return RISE;
}

let WELL = null, GRIT = null;
const wellTexture = () => (WELL ||= blobTexture('rgba(150,106,246,0.85)', 'rgba(58,20,140,0)'));
const gritTexture = () => (GRIT ||= blobTexture('rgba(206,196,214,0.95)', 'rgba(96,86,112,0)'));

// THERE IS NO SHAFT OF LIGHT, and there was one for most of this effect's
// life. A tapered open cylinder standing up out of the mouth, additive, faded
// out along its length: correct from the side and useless here, because this
// camera is 52 degrees above the board and a vertical cone seen from nearly
// overhead is a DISC. What it drew was a violet haze lying flat across the
// card — it greyed the inside of the hole, which is the one part of this that
// has to stay black, and it never once read as a beam from any frame taken.
// Its opacity was tuned twice before it was obvious that no opacity fixes
// geometry. The column of rising dust is the only thing at this angle that can
// say light is coming up out of the ground.

/* --------------------------------------------------------------- the hand */

/**
 * A hand, built out of bones rather than drawn on a sprite.
 *
 * A billboarded cutout was tried first and it was the wrong call: it is the
 * only solid thing in the motif, so it has to take the braziers' light and be
 * clipped by the mouth like an object, or the beat reads as a decal sliding up
 * the card. The cost is that it must survive at about twenty screen pixels.
 *
 * The first build was an anatomical hand — palm plane vertical, four fingers
 * fanned across it — and on this table it was a PALE BAR. The camera sits 52
 * degrees above the board, so a hand held upright is seen nearly end-on and
 * its whole silhouette collapses into the width of the palm. Worse, the fan of
 * a flat hand has an azimuth where it vanishes altogether, and the table
 * orbits, so a quarter of all casts would have shown a stick.
 *
 * So the fingers fan round a CONE instead of across a plane: five claws
 * radiating from the wrist, leaning outward as they rise and hooking down at
 * the tips. Seen from above — which is most of what this camera does — that is
 * a five-pointed grasp, and it reads the same from every side of the table.
 * Not what a hand does anatomically; it is what a hand LOOKS like from above,
 * and at sixty pixels that is the only thing worth being right about.
 */
function skeletalHand() {
  const bone = new THREE.MeshStandardMaterial({
    // Grey-green bone, not ivory, and only a whisper of self-light. At 0xd6cbb2
    // with 0.7 of emissive the claw clipped to flat white under the flash and
    // read as moulded plastic with no modelling in it anywhere; the shading is
    // the only thing at this size that says the fingers are round.
    color: 0xc4b899, roughness: 0.82, metalness: 0,
    // the tint is cold, because a bone lit only by these low warm braziers
    // came up ORANGE — which belongs to Auroxi, not here
    emissive: 0x3d2a7a, emissiveIntensity: 0.36,
  });
  const g = new THREE.Group();
  const rod = (r0, r1, len) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 6), bone);
    m.position.y = len / 2;
    m.castShadow = true;
    return m;
  };

  /** One claw: out along bearing `psi`, leaning `lean` off vertical, hooked. */
  const claw = (psi, lean, l1, l2, r, from) => {
    const f = new THREE.Group();
    // YXZ so the bearing is applied LAST and the lean is read as "outward" in
    // the bearing's direction. In the default XYZ order the lean was applied
    // in world space and every claw leaned the same way — a hand blown flat.
    f.rotation.order = 'YXZ';
    f.rotation.y = psi;
    f.rotation.x = lean;
    f.position.set(Math.sin(psi) * from, 0.165, Math.cos(psi) * from);
    f.add(rod(r, r * 0.86, l1));
    // a bead at the knuckle: without it a claw is one straight rod and the
    // hand reads as a garden fork
    const k = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 6, 5), bone);
    k.position.y = l1;
    f.add(k);
    const tip = new THREE.Group();
    tip.position.y = l1;
    tip.rotation.x = 0.62;          // hooked further over: a grasp, not a rake
    tip.add(rod(r * 0.86, r * 0.5, l2));
    f.add(tip);
    return f;
  };

  // The back of the hand, a squashed ball. A box read as a plinth the claws
  // were screwed into, and the flat-topped drum that replaced it was worse:
  // its top face lies square to the light above the mouth and took it evenly
  // across the whole disc, so the middle of the hand clipped to a white blob
  // and swallowed the knuckles. A curved back rolls the highlight off.
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 7), bone);
  palm.scale.set(1, 0.62, 0.92);
  palm.position.y = 0.09;
  palm.castShadow = true;
  g.add(palm);

  // four fingers over a hundred-degree arc and the thumb swung well off them,
  // so there is a gap in the star that says which way the hand is turned
  const PSI = [-0.86, -0.29, 0.29, 0.86];
  for (let i = 0; i < 4; i++) {
    // The two inside claws are a fifth longer than the two outside them. At
    // nine per cent the five points came out near enough the same length and
    // the whole thing read as a starfish; a hand is only recognisable from
    // above because its digits are ranked, and that has to be exaggerated at
    // this size to survive at all.
    const long = 1 - Math.abs(i - 1.5) * 0.14;
    g.add(claw(PSI[i] + (Math.random() - 0.5) * 0.11, 0.52 + Math.random() * 0.08,
      0.215 * long, 0.165 * long, 0.034, 0.105));
  }
  // the thumb, swung right round and stubby — it is the one digit that says
  // which way up the hand is, so the gap either side of it is deliberate
  g.add(claw(2.32, 1.05, 0.125, 0.095, 0.040, 0.092));

  // THE ARM IS THE CUE. Without a length of forearm crossing the mouth the
  // five claws read as a starfish or a splash, not as a hand — and it has to
  // be long enough that the mouth clips it rather than it ending in the air.
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.05, 0.95, 7), bone);
  arm.position.y = -0.45;
  arm.rotation.x = -0.10;
  arm.castShadow = true;
  g.add(arm);

  // Scaled as a whole at the end: the numbers above are proportions, and this
  // is the one knob that trades legibility against looking like a giant's arm.
  // At 1.35 the grasp is about 33 screen pixels across a 63-pixel card.
  g.scale.setScalar(1.35);
  return { group: g, bone };
}

/* ------------------------------------------------------------- the dust */

/** Motes streaming up out of the mouth for as long as it is open. */
function graveDust(kit, centre, radius) {
  const grp = new THREE.Group();
  const motes = [];
  const N = 26;
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: riseTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // golden angle for WHERE and a coprime stride for WHEN, so the two stay
    // uncorrelated. Seeded at random the outer ring was always the late one
    // and the column visibly unwound from the middle outward.
    const a = i * 2.39996 + Math.random() * 0.4;
    // An ANNULUS, not a disc. The hand is opaque and writes depth, so every
    // mote born on the axis spent its whole life hidden behind the arm and the
    // column simply was not there on screen. Off the broken rim it comes up
    // AROUND the hand, which is also where dust would come off a real edge.
    const r = radius * (0.58 + 0.42 * Math.sqrt((i + 0.5) / N));
    const slot = (i * 9) % N;
    s.userData = {
      x: Math.cos(a) * r, z: Math.sin(a) * r,
      out: 0.10 + Math.random() * 0.22,
      // A COLUMN, and a tall one. At two thirds of this the dust never got
      // clear of the card and the whole motif lived inside sixty pixels; the
      // part of a raise that is visible from across the table is the grave-air
      // standing up off the square.
      top: 0.8 + Math.random() * 1.05,
      // spread across the whole time the mouth is open, so there is always
      // something on its way up; bunched toward the front because the first
      // fifth of a second is most of what a player actually looks at
      off: T.OPEN - 0.06 + ((slot + Math.random() * 0.9) / N) ** 1.35 * (T.SINK - T.OPEN),
      dur: 0.34 + Math.random() * 0.2,
      // Chunky rather than fine. A card is only about sixty pixels across in
      // play and hairline motes at that size are noise — half of them land on
      // the same pixel as a piece of card art and are simply gone.
      w: 0.15 + Math.random() * 0.07,
      len: 0.30 + Math.random() * 0.22,
      lit: 0.62 + Math.random() * 0.38,
    };
    motes.push(s);
    grp.add(s);
  }
  grp.position.copy(centre);
  kit.hold(grp, SPAN, (t) => {
    const s = t * SPAN;
    for (const m of motes) {
      const u = m.userData;
      const k = (s - u.off) / u.dur;
      if (k <= 0 || k >= 1) { m.material.opacity = 0; continue; }
      // slowing as it climbs — dust thrown up, not smoke pouring out
      const climb = 1 - (1 - k) ** 2;
      const fan = 1 + climb * u.out;
      m.position.set(u.x * fan, u.top * climb + 0.02, u.z * fan);
      m.scale.set(u.w, 0.20 + (1 - climb) * u.len, 1);
      m.material.opacity = 0.92 * u.lit * Math.min(1, k * 8) * (1 - k) ** 1.2;
    }
  });
}

/** Grit thrown clear when the hand comes through, and falling back. */
function grit(kit, centre, radius) {
  const grp = new THREE.Group();
  const from = [], vel = [], size = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: gritTexture(), transparent: true, opacity: 0, depthWrite: false,
    }));
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.6;
    const r = radius * (0.55 + Math.random() * 0.5);
    from.push(new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r));
    vel.push(new THREE.Vector3(Math.cos(a) * (0.5 + Math.random() * 0.8),
      1.5 + Math.random() * 1.5, Math.sin(a) * (0.5 + Math.random() * 0.8)));
    // chunky: at two pixels a clod of earth is a dead pixel, not a clod
    size.push(0.10 + Math.random() * 0.075);
    grp.add(s);
  }
  grp.position.copy(centre);
  // NOT additive: this is matter, not light. Additive grit glowed like more
  // sparks and the throw stopped reading as earth coming off the stone.
  const life = 0.62;
  kit.hold(grp, SPAN, (t) => {
    const k = (t * SPAN - T.BREACH) / life;
    grp.visible = k > 0 && k < 1;
    if (!grp.visible) return;
    for (let i = 0; i < grp.children.length; i++) {
      const sp = grp.children[i];
      const s = k * life;
      sp.position.copy(from[i]).addScaledVector(vel[i], s);
      sp.position.y -= 4.4 * s * s;          // and it comes back down
      sp.scale.setScalar(size[i]);
      sp.material.opacity = 0.85 * Math.min(1, k * 9) * (1 - k) ** 1.1;
    }
  });
}

/* --------------------------------------------------------------- the beat */

export function raise(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const piece = kit.piece(at);
  const base = p.clone().setY(flatY(p, !!piece));
  // Every grave opens differently; five cards share this motif and The Living
  // Dead fires it on several squares in one breath, so a fixed tear pattern
  // read as the same texture stamped twice.
  const yaw = Math.random() * Math.PI * 2;
  // The HAND, though, is not turned at random. This camera only ever sits at
  // one of two bearings — main.js swings it to 0 or PI and nowhere else — and
  // a grasp turned broadside to it is seen edge-on and collapses to a stick.
  // So it is pointed roughly toward the camera or roughly away from it, with
  // enough slop that two raises are never the same, and never across.
  const handYaw = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.3;
  const HOLE_R = HOLE_QUAD * 0.36;           // world radius of the painted tear

  /* ---- the card is shoved from underneath ---- */
  // A jolt on the first frame of the breach and a short settle. The flat parts
  // ride it, or the mouth tears free of the card it is cut into — that cost
  // twenty minutes of wondering why the hole slid off the card.
  const heave = (s) => (s < T.BREACH ? 0
    : 0.055 * Math.exp(-(s - T.BREACH) * 7) * Math.cos((s - T.BREACH) * 15));

  /* ---- the flat layers: seams, mouth, lip, welling light ---- */
  const flat = new THREE.Group();
  flat.position.copy(base);
  // The tear is yawed but the LIGHT in it is not. Lit from inside a hole that
  // spins with the texture, the bright spot landed on a different wall every
  // cast; the throat is lit from one side always, which is what gives a flat
  // black disc any depth at all.
  const torn = new THREE.Group();
  torn.rotation.y = yaw;
  flat.add(torn);

  const quad = (map, size, order, parent, opts = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map, transparent: true, opacity: 0, depthWrite: false, ...opts,
      }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = order;
    parent.add(m);
    return m;
  };
  const add = THREE.AdditiveBlending;
  const cracks = crackTextures();
  const seamDark = quad(cracks.dark, CRACK_QUAD, 10, torn);
  const seamLit = quad(cracks.lit, CRACK_QUAD, 11, torn, { blending: add });
  const mouth = quad(holeTexture(), HOLE_QUAD, 12, torn);
  const lip = quad(lipTexture(), HOLE_QUAD, 13, torn, { blending: add });
  const well = quad(wellTexture(), HOLE_QUAD * 0.78, 14, flat, { blending: add });
  // pushed to the far wall of the throat, away from the camera
  well.position.z = -HOLE_R * 0.30;

  /* ---- the hand ---- */
  const hand = skeletalHand();
  hand.group.position.copy(base);
  // YXZ: the lean is taken about the yawed axis, so the hand leans the way it
  // is turned. About a third of a right angle off upright — enough that the
  // grasp opens toward the camera rather than pointing at it, and not so much
  // that the arm stops reading as coming UP.
  hand.group.rotation.order = 'YXZ';
  hand.group.rotation.y = handYaw;
  const lean = 0.58 + Math.random() * 0.14;
  hand.group.rotation.x = lean;
  // and stepped FORWARD along the lean, because what has to sit over the
  // middle of the mouth is the point where the ARM crosses it, not the palm —
  // the arm runs back down the lean from the wrist. Stepped the other way (the
  // obvious way) the hand floated clear above the card and the hole sat behind
  // it like a shadow that had come loose.
  const off = 0.13;
  hand.group.position.x += Math.sin(lean) * Math.sin(handYaw) * off;
  hand.group.position.z += Math.sin(lean) * Math.cos(handYaw) * off;
  // Palm-base heights, measured against the mouth. The claws reach about 0.45
  // above the palm once it is leaning, so DEEP buries the whole arm, TIPS is
  // the moment the points are level with the stone, and HIGH leaves a hand's
  // width of forearm standing out of the hole.
  const DEEP = -1.35, TIPS = -0.45, HIGH = 0.22;
  kit.hold(hand.group, SPAN, (t) => {
    const s = t * SPAN;
    let y;
    if (s < T.OPEN) y = DEEP;
    else if (s < T.BREACH) {
      // stirring in the dark under the mouth, mostly hidden by it
      y = DEEP + (TIPS - DEEP) * easeIn((s - T.OPEN) / (T.BREACH - T.OPEN));
    } else if (s < T.CREST) {
      const k = (s - T.BREACH) / (T.CREST - T.BREACH);
      // thrown up hard and pulled short — the arm runs out of reach rather
      // than gliding to a stop
      y = TIPS + (HIGH - TIPS) * easeOut(k) + 0.05 * Math.sin(k * Math.PI) ** 2;
    } else if (s < T.SINK) {
      // holding, shaking with the effort
      y = HIGH + 0.012 * Math.sin((s - T.CREST) * 34);
    } else {
      // Dragged back down, and CLEAR of the mouth by GONE — from there the
      // mouth starts closing and stops covering what is below it. On a cube
      // ease the claws were still a third of a card above the stone when the
      // hole had shrunk out from under them, and the tips hung over the card
      // art with nothing holding them, which looked like a bug and was one.
      const k = Math.min(1, (s - T.SINK) / (T.GONE - T.SINK));
      y = HIGH + (DEEP - HIGH) * (k * k * 0.68 + k * 0.32);
    }
    hand.group.position.y = base.y + y + heave(s);
    // The light in the throat rakes across it as it passes the mouth. The
    // range has to STRADDLE the value the material was tuned at — set to
    // 0.55..1.10 here it quietly overrode the 0.36 chosen against a screenshot
    // every single frame, and the claw was back to white plastic with no clue
    // in the material why.
    hand.bone.emissiveIntensity = 0.26 + 0.32 * Math.max(0, 1 - Math.abs(y) * 1.4);
  });

  /* ---- the flats, in time ---- */
  kit.hold(flat, SPAN, (t) => {
    const s = t * SPAN;
    flat.position.y = base.y + heave(s);

    // the seams arrive first and outlive the hole, since a crack in stone does
    const seam = Math.min(1, Math.max(0, (s - 0.02) / (T.CRACK - 0.02)));
    const seamOut = s < T.GONE ? 1 : Math.max(0, 1 - (s - T.GONE) / (T.SHUT - T.GONE));
    seamDark.material.opacity = 0.88 * seam * seamOut;
    // The light in the seam is at nearly full strength the moment it is drawn,
    // peaks at the breach, and dies with the hand. Ramped up from a third it
    // was a smudge for the first fifth of a second — which is exactly the
    // stretch where the seams are the only thing happening.
    seamLit.material.opacity = seam * seamOut
      * (s < T.BREACH ? 0.78 + 0.22 * (s - 0.02) / (T.BREACH - 0.02) : 1)
      * (s < T.CREST ? 1 : Math.max(0.15, 1 - (s - T.CREST) / (T.SINK - T.CREST)));
    const seamS = 0.55 + 0.45 * seam;
    seamDark.scale.setScalar(seamS);
    seamLit.scale.setScalar(seamS);

    // the mouth parts, holds, and knits back to a seam. It SHUTS rather than
    // fading: squeezed on one axis only, so the last thing on the card is a
    // violet slit going out, which is the ground closing and not a light
    // being switched off.
    const open = easeOut(Math.min(1, Math.max(0, (s - T.CRACK) / (T.BREACH - T.CRACK))));
    // Mostly LINEAR. On a cubic ease the slot sat at two thirds of its width
    // until the last twenty-five thousandths and then vanished, so the ground
    // did not close — the hole was switched off.
    const kn = Math.max(0, (s - T.GONE) / (T.SHUT - T.GONE));
    const knit = kn * kn * 0.35 + kn * 0.65;
    const sx = (0.18 + 0.82 * open) * (1 - 0.14 * knit);
    const sy = (0.18 + 0.82 * open) * (1 - 0.95 * knit);
    for (const m of [mouth, lip, well]) m.scale.set(sx, sy, 1);
    // OPAQUE well before it is fully open: the mouth widens, it does not fade
    // up. Tied straight to `open` it spent the first fifth of a second at
    // three quarters alpha and the card art showed through the hole — a grey
    // lozenge rather than a hole, which is the one thing it cannot be.
    mouth.material.opacity = Math.min(1, open * 2.2)
      * (1 - knit * 0.3) * Math.min(1, (1 - knit) * 4.5);
    lip.material.opacity = (0.35 + 0.65 * open) * (1 - knit ** 3);
    // the glow in the throat: nothing until the stone parts, brightest as the
    // hand comes through, then drawn down with it
    const lit = s < T.BREACH ? open * 0.5
      : s < T.CREST ? 0.5 + 0.5 * easeOut((s - T.BREACH) / (T.CREST - T.BREACH))
      : Math.max(0, 1 - (s - T.CREST) / (T.GONE - T.CREST));
    well.material.opacity = 0.44 * lit;
  });

  /* ---- dust, grit, and the shock ---- */
  graveDust(kit, base, HOLE_R);
  grit(kit, base.clone().setY(base.y + 0.01), HOLE_R);

  // Lights, and HEIGHT is what they are tuned on rather than power: a point
  // light decays with the square of the distance, so anything strong sitting
  // a few hundredths above the card blows the whole face to white and takes
  // the mouth with it. Both of these sit half a card's width up or more.
  kit.after(T.CRACK, () => kit.light(base.clone().setY(base.y + 0.75), 0x6f32e2,
    { power: 2.1, seconds: T.CREST - T.CRACK, reach: 2.4 }));
  // Saturated, and not much of it. A pale lilac at this power washed the whole
  // square GREY — filmic tone mapping takes any light colour toward white as
  // the exposure climbs — and grey fog on stone is not a Gloaming card going
  // off. At 10 it also drove the bone past the clipping point and the claw came
  // out a flat white paper cut-out with its modelling gone. The punch of the
  // breach is the ring and the grit; the light only says what colour it was.
  kit.after(T.BREACH, () => kit.light(base.clone().setY(base.y + 1.15), 0x8a58f0,
    { power: 3.0, seconds: 0.5, reach: 3.1 }));
  // The shock running out across the stone from under the card — and the size
  // is a narrow window, not a taste. kit.ring draws at y = 0.1, BENEATH a card
  // whose face is at 0.21, so the ring is hidden until it grows past the
  // card's own half-width: under about 1.8 it never escapes and nothing is
  // drawn at all. Over about 3 the band is 0.5 wide and still at half alpha
  // when it clears the edge, which parks a flat lavender slab around the
  // square. That slab got blamed on the point lights and then on the shaft of
  // light, both of which were cut back for it, before the ring was measured —
  // a diagnosis is worth more than a plausible suspect. At 2 only the fading
  // tail gets out, which is the flick of violet this wants.
  kit.after(T.BREACH, () => kit.ring(base, 0x9f74ea, { size: 2.0, seconds: 0.4 }));
  // and a second, slower one as the ground shuts
  kit.after(T.GONE, () => kit.ring(base, 0x6c3fc4, { size: 2.0, seconds: 0.45 }));

  /* ---- the card takes the shove ---- */
  // ...but only if it is standing still. Four of the five cards that use this
  // motif DEPLOY the fighter, so the card can be halfway through its own move
  // tween when the effect fires, and forcing it to its resting position for
  // the heave teleported it across the board mid-flight. If it is already
  // moving, the arrival is animation enough.
  if (piece?.restingPosition && !piece.animating) {
    const home = piece.restingPosition();
    kit.hold(new THREE.Object3D(), T.SINK, (t) => {
      const s = t * T.SINK;
      const pc = kit.piece(at);
      if (!pc || s < T.BREACH) return;
      // set every tick, not once: the board's own move tween clears this flag
      // when it ends and the card was snapping home mid-heave
      pc.animating = true;
      pc.group.position.copy(home);
      pc.group.position.y += heave(s);
    }, () => {
      const pc = kit.piece(at);
      if (pc) { pc.group.position.copy(home); pc.animating = false; }
    });
  }
}
