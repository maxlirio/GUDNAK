// THE DEAD GET UP — souls run in from the discard pile and go into the ground
// under the square, the stone cracks, a grave-mouth opens on it, and a hand
// comes up out of what they fed.
//
// Shared by 5 cards: C084, C087, C110, A068, R072 — Necromancer, Echoing
// Specter, Soul Swap, The Living Dead, Shallow Grave. Every one of them takes
// a fighter OUT OF THE GRAVEYARD and stands it on a square, so the picture is
// always the same: a hole opens where the card is, something climbs out of it,
// and the ground closes again.
//
// WHERE THE DEAD COME FROM IS NOW IN THE PICTURE, and that is the one thing
// this motif was missing. The hand used to simply arrive: a grave opened on a
// square that had nothing to do with the Graveyard, and the card being brought
// back was somewhere else entirely. The current fixes it in the faction's own
// terms — a stream of souls leaves the discard pile, runs low across the
// flagstones, and goes UNDER the card, and only then does the ground break.
// The hand is what the current builds. (harvest.js carries the same current
// and its file explains it at length; the two are deliberately the same world,
// and the shape was asked for in as many words: "more souls channeling from
// the discard to underneath them". It replaced a thrown-and-reeled line that
// read as a mouse dragging an icon, and nothing here may become one — nothing
// in this motif travels from the card toward the pile.)
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
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=760&zoom=4.6" \
//             --eval tools/fxdemo/raise.js --out /tmp/r.png --wait 10000 --settle 600
// `t` is the point in the MOTIF to freeze at, in milliseconds. The harness
// explains why wall-clock --settle cannot be trusted to land on a moment, and
// carries ?zoom, ?seat, ?grave, ?bare, ?many and ?fxseed. USE ?zoom: drama.js
// pushes the camera in by 4.6 and slows the clock to 0.48 on every raise, so a
// shot taken at plain table distance is not the shot the player gets. USE
// ?seat=1 too — the hand is aimed at the lens, the far seat is where the
// arena's key light is behind it, and it is also the only way to stage the
// current coming from a pile ACROSS the table rather than the near one.
//
// ?grave, ?bare and ?many are the three the CURRENT has to survive and none of
// them is exotic: the souls come off the discard pile, so its height is part
// of the picture; four of these five cards can deploy into open ground, where
// there is no card for the pool to be a fringe around; and The Living Dead
// fires this on three squares in one breath, which is three currents out of
// one pile at once.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { graveyardPosition } from '../../board.js';

/**
 * The beat, in seconds — phase boundaries, not durations.
 *
 * Everything from CRACK on is unchanged in SHAPE and shifted 0.26 later, which
 * is what the current in front of it costs. That lead-in is not padding: the
 * souls have to be seen leaving the pile, crossing, and going under the card
 * BEFORE the stone gives way, or the two halves read as two effects that
 * happened to fire together. A quarter of a second is the least that reads,
 * and drama.js halves the clock on every raise, so the player gets half a
 * second of it.
 */
const T = {
  WAKE: 0.02,     // the pile stirs and the first souls come off it
  CRACK: 0.42,    // a violet seam scribes itself across the card
  OPEN: 0.64,     // the seam parts into a mouth; cold light wells up it
  BREACH: 0.78,   // fingers break the plane — ring, flash, grit
  FLOW: 0.92,     // the last soul leaves the pile
  CREST: 1.06,    // full reach, held, trembling
  SINK: 1.26,     // the arm is drawn back down into the dark
  GONE: 1.48,     // nothing left above the stone
  SHUT: 1.74,     // the mouth knits to a seam and the light dies
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
// camera is 46 degrees above the board and a vertical cone seen from nearly
// overhead is a DISC. What it drew was a violet haze lying flat across the
// card — it greyed the inside of the hole, which is the one part of this that
// has to stay black, and it never once read as a beam from any frame taken.
// Its opacity was tuned twice before it was obvious that no opacity fixes
// geometry. The column of rising dust is the only thing at this angle that can
// say light is coming up out of the ground.

/* --------------------------------------------------------------- the hand */

/**
 * The camera, borrowed from the first thing this motif draws.
 *
 * The hand is built to be LOOKED AT — back of the hand to the lens, fingers
 * spread across the view — and that is only possible if it knows where the
 * lens is. Nothing in `kit` hands a motif the camera, so the flat quad that is
 * on screen from the very first frame is used as a peephole: three.js calls
 * onBeforeRender with the camera it is drawing for. Checked for a perspective
 * camera because the shadow pass renders from the sun's, and a hand that
 * turned to face the shadow camera would spin once per frame.
 */
let CAM = null;
const peep = (renderer, scene, cam) => { if (cam.isPerspectiveCamera) CAM = cam; };

/**
 * A pile of little bones merged into ONE mesh, with the light baked in.
 *
 * Two things this buys, and both were failures of the version before it. One
 * mesh instead of forty is one draw call, and The Living Dead opens three
 * graves in a breath. More importantly the merge is where the SHADING comes
 * from: a vertex colour per corner, dark underneath and bright on top, so the
 * hand has form before a single lamp in the arena is consulted. The old hand
 * had nothing but lights, and the arena's lights are a warm key, a blue sky
 * and two violet flashes fired point-blank at it — which sum past 1.0 in every
 * channel and come out of the filmic curve as flat white. Baked dark cannot be
 * washed out, because it multiplies the albedo rather than adding to it.
 */
const BAKE_L = new THREE.Vector3(-0.26, 0.79, 0.55).normalize();
const HULL = 0.024;        // world units the dark keyline stands off the bone
class Bones {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.hull = []; }

  /**
   * `t0`/`t1` are how bright this bone is at its base and at its tip. The
   * ranking is the whole trick for reading at this size: the wrist and the
   * backs of the metacarpals are kept DARK, and brightness is spent on the
   * knuckles and the finger tips — the parts that say "hand". Spread evenly
   * the mass in the middle wins the eye and the thing is a mushroom.
   */
  add(geo, m, t0 = 1, t1 = t0, len = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const u = len > 0 ? Math.min(1, Math.max(0, v.y / len + 0.5)) : 0.5;
      v.applyMatrix4(m);
      nv.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      // wrapped lambert: the dark side bottoms out at a sixth rather than at
      // black, because a bone in a torchlit ruin still catches the sky
      const lam = 0.5 + 0.5 * nv.dot(BAKE_L);
      const c = (t0 + (t1 - t0) * u) * (0.16 + 0.84 * lam ** 1.3);
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(nv.x, nv.y, nv.z);
      this.col.push(c, c, c);
      this.hull.push(v.x + nv.x * HULL, v.y + nv.y * HULL, v.z + nv.z * HULL);
    }
    if (g !== geo) g.dispose();
  }

  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    return m;
  }

  /**
   * The keyline: the same bones, every vertex pushed out along its normal,
   * drawn back-faces-only so it survives only where the bone itself does not
   * cover it. It is the oldest trick in line art and it is here for the reason
   * the seams already use it two hundred lines up — a pale object on card art
   * that is itself pale has no edge, and at this size an edge is most of what
   * there is. It also puts a dark seam BETWEEN two bones that touch, which is
   * what stops four fingers merging into one paddle.
   */
  outline() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.hull, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0x0a0616, side: THREE.BackSide,
    }));
  }
}

/**
 * A dead hand, reaching.
 *
 * THIS IS THE THIRD BUILD AND THE FIRST TWO ARE WORTH KNOWING.
 *
 * The first was an anatomical hand held upright, and it was a PALE BAR: this
 * camera sits 46 degrees above the board, so a hand stood on its wrist is seen
 * nearly end-on and its silhouette collapses to the width of the palm. Worse,
 * a flat fan has an azimuth where it vanishes altogether.
 *
 * The second answered that by abandoning the hand: five claws fanned round a
 * CONE, which does read from every bearing. It was rejected on sight — "the
 * skeleton hand is really malformed". It was a white mushroom. A cone of claws
 * of near-equal length has NO GAPS in silhouette, and gaps are most of what
 * makes a hand a hand; the ball at its middle was the brightest thing on the
 * table; and it was one flat value throughout, so it had an outline and no
 * form at all.
 *
 * The cone is gone. What made it necessary was not knowing where the camera
 * was — and the camera is knowable: main.js only ever puts it at one of two
 * bearings, so the hand is YAWED TO FACE IT every frame (see `peep`). Freed of
 * that, this is a real hand again, and built for this one view:
 *
 *   - It is laid BACK about 44 degrees, so its plane is square to a lens that
 *     is 46 degrees up. The fingers then run across the screen at their full
 *     length instead of being foreshortened into stubs.
 *   - It is SPREAD, hard, much wider than a living hand opens. Height costs
 *     26 pixels a world unit and width costs nothing, and the four gaps
 *     between five digits are the entire silhouette.
 *   - The back of it is four METACARPALS, not a palm. A skeleton's hand is a
 *     fan of separate bones with dark between them; a solid back is the blob
 *     the last build was rejected for.
 *   - The thumb stands off toward the camera, and is the only digit that says
 *     which way up a hand is.
 *   - Value is RANKED: dark wrist, dark metacarpals, bright knuckles, bright
 *     tips. Baked in, per vertex, not asked of the lights.
 *   - It carries a BLACK KEYLINE (`Bones.outline`). Half the hand is over card
 *     art at full reach, and pale bone on pale art has no edge at all.
 *
 * What is NOT here, because it was tried: no palm, no solid back of any kind,
 * and no more emissive. Every one of those is the mushroom coming back. If
 * this ever looks flat again the answer is more DARK — a lower albedo, deeper
 * vertex colours, a heavier keyline — and never a brighter bone.
 */
function skeletalHand({ armDir, tilt, roll, side }) {
  const bone = new THREE.MeshStandardMaterial({
    // Warm ivory, but MID — the last one was 0xc4b899 flat-lit and came out as
    // the brightest object in frame now that the key is a spot confined to the
    // board. The vertex colours below take most of it darker again, so this is
    // the value of the brightest knuckle rather than of the whole hand.
    color: 0xcbb692, roughness: 0.88, metalness: 0, vertexColors: true,
    // a whisper, and COLD: bone lit only by the braziers came up orange, which
    // belongs to Auroxi. Four times this much (which is where the teeth in
    // shardfire went wrong) makes a flat lozenge no light can model.
    emissive: 0x33246b, emissiveIntensity: 0.30,
  });

  const B = new Bones();
  const M = new THREE.Matrix4(), TR = new THREE.Matrix4();
  const root = new THREE.Object3D();
  const node = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  /** A shaft along the node's +Y, base at its origin. */
  const shaft = (at, r0, r1, len, t0, t1) => {
    at.updateWorldMatrix(true, false);
    const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1, true);
    B.add(g, M.multiplyMatrices(at.matrixWorld, TR.makeTranslation(0, len / 2, 0)), t0, t1, len);
    g.dispose();
  };
  /** A joint bead. Without them a finger is a rod and the hand is a fork. */
  const bead = (at, y, r, t, squash = 1, wide = 1) => {
    at.updateWorldMatrix(true, false);
    const g = new THREE.SphereGeometry(r, 7, 5);
    g.scale(wide, squash, 1);
    B.add(g, M.multiplyMatrices(at.matrixWorld, TR.makeTranslation(0, y, 0)), t, t, 0);
    g.dispose();
  };
  const jit = (k) => (Math.random() - 0.5) * k;

  /* ---- the hand, laid back so its plane faces the lens ---- */
  // +X across the view, +Y up the fingers, +Z out of the back of the hand and
  // therefore toward the camera. rotation.x of -tilt swings the back up to
  // meet a lens that is 46 degrees above the table.
  const hand = node(root, 0, 0, 0);
  hand.rotation.order = 'ZXY';
  hand.rotation.x = -tilt;
  hand.rotation.z = roll;

  // carpals: a flat pebble, WIDE, and deliberately DIM. A wrist is nearly as
  // broad as the knuckles it carries, and this is also the part that used to
  // be a bright ball dominating the whole shape.
  bead(hand, -0.02, 0.085, 0.40, 0.50, 1.5);

  // The digits, laid out across the view.
  //
  // Two things here were each a failed build of their own. The metacarpals
  // start SIDE BY SIDE ACROSS THE WRIST and run nearly parallel: fanned from a
  // single point, four fingers and a thumb radiate like a bird's foot however
  // well the bones themselves are drawn, and the back of a hand is a raft of
  // bones lying alongside each other with thin dark lines between them. And
  // they are SHORT AND THICK with big knuckle beads, against fingers that are
  // long and thin: a hand reads as a wedge, narrow at the wrist and wide at
  // the knuckles, and none of that exists if every bone is the same stick.
  //
  // The splay is wider than a living hand opens. The gaps ARE the picture, and
  // width costs nothing at this camera while height costs 26 pixels a unit.
  const AT = [-0.080, -0.027, 0.027, 0.078];
  const SPLAY = [-0.34, -0.11, 0.10, 0.31];
  const FAN = [-0.20, -0.07, 0.07, 0.18];     // they keep fanning past the knuckle
  const MC = [0.245, 0.275, 0.26, 0.225];
  const PROX = [0.190, 0.215, 0.200, 0.148];
  const DIST = [0.135, 0.152, 0.140, 0.108];
  for (let i = 0; i < 4; i++) {
    const d = node(hand, AT[i] * side, 0.02, 0);
    d.rotation.order = 'ZXY';
    // `side` mirrors the whole hand so a left and a right one both occur
    d.rotation.z = -SPLAY[i] * side + jit(0.05);
    d.rotation.y = jit(0.10);
    // a little out of the plane, alternating, so the four are not a comb
    d.rotation.x = 0.06 * (i % 2 ? 1 : -1) + jit(0.05);
    shaft(d, 0.047, 0.040, MC[i], 0.30, 0.60);

    const k = node(d, 0, MC[i], 0);
    k.rotation.z = -FAN[i] * side + jit(0.05);
    // The fingers hook TOWARD the lens. Hooked the other way they bend in the
    // one direction this camera cannot see — the hand's plane is square to it
    // — and they came out dead straight, five parallel straws. Coming forward,
    // the tip drops down the screen and shortens, which is the whole claw
    // shape, while the rest of the digit keeps its length.
    k.rotation.x = 0.34 + jit(0.1);
    bead(k, 0, 0.052, 0.98, 0.82);
    // dark at the base of the shaft and bright at the far end: a dark band
    // under every bright knuckle is what separates one bone from the next at
    // three pixels across
    shaft(k, 0.038, 0.030, PROX[i], 0.46, 0.88);

    const k2 = node(k, 0, PROX[i], 0);
    // The fold at the last joint, and it is a narrow window. Under about a
    // third of a radian the fingers are four straight blades and the hand is a
    // fork; over about three quarters the tip turns far enough toward the lens
    // that it hides behind its own finger and the claws end BLUNT. This much
    // reads as a hook and still shows the point.
    k2.rotation.x = 0.64 + jit(0.14);
    bead(k2, 0, 0.038, 0.92, 0.85);
    shaft(k2, 0.030, 0.011, DIST[i], 0.70, 1.0);
  }

  // The thumb: swung right out and standing proud TOWARD the camera, which is
  // the one thing in the silhouette that says this is a hand and not a rake.
  // It is the thickest digit and the only one set below the knuckle line, so
  // the gap either side of it is a hole in the shape and not a wide finger.
  const th = node(hand, -0.05 * side, -0.04, 0.03);
  th.rotation.order = 'ZXY';
  th.rotation.z = 1.30 * side + jit(0.08);
  th.rotation.x = 0.50;
  shaft(th, 0.050, 0.042, 0.185, 0.34, 0.66);
  const t2 = node(th, 0, 0.185, 0);
  t2.rotation.z = 0.20 * side;
  t2.rotation.x = 0.30;
  bead(t2, 0, 0.050, 0.95, 0.82);
  shaft(t2, 0.040, 0.031, 0.125, 0.50, 0.90);
  const t3 = node(t2, 0, 0.125, 0);
  t3.rotation.x = 0.58;
  bead(t3, 0, 0.033, 0.92, 0.85);
  shaft(t3, 0.030, 0.011, 0.088, 0.72, 1.0);

  /* ---- the forearm ---- */
  // TWO BONES, not a tube. A smooth pale cylinder read as plastic; a radius
  // and an ulna with daylight between them read as a skeleton from the first
  // glance, and the gap is the only detail here that survives at play size.
  // They are also the CUE: without a length of arm crossing the mouth, a
  // spread hand is a starfish lying on the card.
  const arm = new THREE.Object3D();
  root.add(arm);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
    armDir.clone().negate());
  for (const [dx, tiltZ, r0, r1, len] of [
    [-0.065, 0.030, 0.058, 0.072, 1.20],
    [0.058, -0.044, 0.050, 0.064, 1.14],
  ]) {
    const b = node(arm, dx * side, 0.03, 0);
    b.rotation.z = tiltZ * side;
    // Dark going DOWN into the hole — and the ends are this way round because
    // the arm is built from the wrist downward, so t0 is the WRIST. Written
    // the obvious way round, the only stretch of arm anyone ever sees, the
    // hand's width of it above the stone, was the dark end, and it read as two
    // scratches on the card rather than as a forearm.
    shaft(b, r0, r1, len, 0.62, 0.12);
  }
  // the knobs either side of the wrist — the styloids. They are what makes the
  // join between arm and hand a joint instead of a seam.
  bead(arm, 0.02, 0.055, 0.62, 0.8);
  const st = node(arm, 0.075 * side, 0.03, 0);
  bead(st, 0, 0.036, 0.72, 0.9);

  const mesh = B.build(bone);
  const group = new THREE.Group();
  group.add(B.outline());
  group.add(mesh);
  // The proportions above are a hand about 0.8 world units across the spread
  // tips; this is the one knob that trades presence against looking like a
  // giant's arm. At 1.12 it is roughly 32 pixels of hand on a 63-pixel card,
  // which is a hand you can count the fingers of without leaning in.
  group.scale.setScalar(1.12);
  return { group, bone };
}

/* ------------------------------ the current, in from the discard pile */

/*
 * WHERE THE DEAD COME FROM. Everything in this section runs ONE WAY, from the
 * pile to the square, and nothing in it ever travels back.
 *
 * That is not a stylistic preference, it is the note this rebuild exists to
 * answer. What stood in harvest.js — the other half of this pair — was a strap
 * of grave-wrapping whipped from the card across the table to the discard
 * pile, biting it and REELING a prize home, and it was rejected in as many
 * words: "should be more souls channeling from the discard to underneath them.
 * This gets rid of the messy click and drags." A line thrown at a pile and
 * hauled back is a mouse dragging an icon however it is painted, and it makes
 * the CARD the actor and the graveyard a target, which is backwards for a
 * faction whose whole subject is that the dead come on their own. So: a
 * current, arriving, and then the ground gives way.
 *
 * harvest.js carries the same current and its comments argue the look out at
 * length. The two files are deliberately the same world and the numbers below
 * are the ones that survived being photographed there; the differences are
 * that this one is timed in SECONDS against T rather than in fractions, and
 * that it ends by FEEDING something instead of handing a card back.
 */

// Cached for the life of the page, like every other map in this file:
// kit.hold disposes materials, and a material never disposes its map.
let SOUL = null, BED = null, POOL = null, HEM = null;

const flatCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

/**
 * One soul: a pale head with a violet tail opening out behind it, head at the
 * TOP of the canvas.
 *
 * Drawn row by row rather than as two crossed gradients, because the taper is
 * the whole picture — a capsule is the same width end to end and has no
 * direction in it, so a frozen frame of thirty capsules is a handful of
 * glowing pills lying on the board rather than a current.
 *
 * THE TWO PLACES THIS GOES WRONG ARE BOTH ABOUT HOW BIG THE BRIGHT PART IS,
 * and both were paid for on harvest.js with the souls painted flat green to
 * prove they were being drawn at all:
 *   - the head is where the alpha peaks, so it must not also be where the
 *     sprite is NARROWEST. Opened from 0.30 of the canvas at the head out to
 *     0.92 down the tail — textbook comet — the only full-strength pixels in a
 *     soul were a spike two pixels across, and thirty souls correctly placed
 *     across the board rendered as four faint smudges. It is a bulb now.
 *   - across the width it needs a short plateau, not a spike and not a bar.
 *     Full alpha on the centre line alone is the same absent detail; full
 *     alpha over half the width makes flat pale strips that merge into each
 *     other, and the current came out as four fat lilac smoke strokes.
 *
 * Bone at the head, grave-violet down the tail, red held down the whole way.
 * Pale lilac is the trap cast-gloaming names: any pale colour, additive, comes
 * out of the filmic curve as white.
 */
function soulTexture() {
  if (SOUL) return SOUL;
  const W = 64, H = 160;
  const c = flatCanvas(W, H);
  const g = c.getContext('2d');
  const HEAD = [184, 158, 255], MID = [124, 76, 234], TAIL = [54, 20, 140];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const half = (W / 2) * (0.50 + 0.46 * Math.min(1, (v * 2.2) ** 0.6));
    const a = Math.min(1, v * 5.5) * (1 - v);
    if (a <= 0.002) continue;
    const k = Math.min(1, v * 1.7);
    const col = k < 1
      ? HEAD.map((x, i) => Math.round(x + (MID[i] - x) * k))
      : MID.map((x, i) => Math.round(x + (TAIL[i] - x) * Math.min(1, (v - 0.45) / 0.55)));
    const grd = g.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
    const rgb = `${col[0]},${col[1]},${col[2]}`;
    grd.addColorStop(0.00, `rgba(${rgb},0)`);
    grd.addColorStop(0.20, `rgba(${rgb},${(a * 0.34).toFixed(3)})`);
    grd.addColorStop(0.33, `rgba(${rgb},${(a * 0.80).toFixed(3)})`);
    grd.addColorStop(0.50, `rgba(${rgb},${a.toFixed(3)})`);
    grd.addColorStop(0.67, `rgba(${rgb},${(a * 0.80).toFixed(3)})`);
    grd.addColorStop(0.80, `rgba(${rgb},${(a * 0.34).toFixed(3)})`);
    grd.addColorStop(1.00, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, y, W, 1);
  }
  SOUL = texOf(c);
  return SOUL;
}

/**
 * The bed: a near-black groove the current runs down.
 *
 * The contrast in this motif is BOUGHT WITH DARK, the same way the mouth is —
 * a dark effect on a dark board is invisible and the answer is never a
 * brighter purple. The souls burn against this rather than against warm lit
 * stone and warm lit card art.
 *
 * It fades out at both ENDS as well as at the selvedges, because it does not
 * lie on the flagstones (see BED_Y) — it is drawn over whatever the run
 * crosses, and a hard-cut dark rectangle appearing in mid-air over a card face
 * is a rendering fault, not a shadow.
 */
function bedTexture() {
  if (BED) return BED;
  const N = 64;
  const c = flatCanvas(N, N);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, N);
  grd.addColorStop(0.00, 'rgba(6,2,16,0)');
  grd.addColorStop(0.22, 'rgba(6,2,16,0.52)');
  grd.addColorStop(0.50, 'rgba(4,1,12,0.86)');
  grd.addColorStop(0.78, 'rgba(6,2,16,0.52)');
  grd.addColorStop(1.00, 'rgba(6,2,16,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = 'destination-in';
  const len = g.createLinearGradient(0, 0, N, 0);
  len.addColorStop(0.00, 'rgba(0,0,0,0)');
  len.addColorStop(0.16, 'rgba(0,0,0,1)');
  len.addColorStop(0.84, 'rgba(0,0,0,1)');
  len.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = len;
  g.fillRect(0, 0, N, N);
  BED = texOf(c);
  return BED;
}

/**
 * What the current makes under the square: an ANNULUS, not a disc.
 *
 * Laid on the stone below the card, so the card covers its middle and only the
 * outer ring escapes around the card's own edge — which is the whole picture,
 * a card lit by something underneath it. A disc spends all its brightness
 * where the card hides it and has nothing left at the rim.
 *
 * The bright band is at 0.74 of the radius because the plate is CARD_W*1.62
 * across: half of that is 1.41 units against a card's own 0.87, so a ring
 * peaking at 0.58 peaks INSIDE the card's footprint and only its dying skirt
 * escapes. Held well off white — at (184,148,255) on the band this measured
 * three hundred clipped pixels and read pink, which is the loudest and warmest
 * thing this faction is ever allowed to be.
 */
function poolTexture() {
  if (POOL) return POOL;
  const c = flatCanvas(256, 256);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0.00, 'rgba(104,58,214,0.10)');
  grd.addColorStop(0.46, 'rgba(112,62,224,0.22)');
  grd.addColorStop(0.62, 'rgba(126,80,240,0.52)');
  grd.addColorStop(0.74, 'rgba(152,120,252,0.88)');
  grd.addColorStop(0.86, 'rgba(98,48,214,0.30)');
  grd.addColorStop(1.00, 'rgba(62,24,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  POOL = texOf(c);
  return POOL;
}

/**
 * The hem: dark drawn inward from the card's own border, nothing in the middle.
 *
 * The ring above is on warm lit STONE, and a violet fringe on warm lit stone
 * is a smudge. This goes on the card FACE and gives the fringe something black
 * to burn against on its inner side. Alpha 0 through the middle so the art and
 * the badges are untouched — and it is gone by the time the seams arrive,
 * because from OPEN on the mouth brings its own dark and two of them stacked
 * is a card that has simply gone out.
 */
function hemTexture() {
  if (HEM) return HEM;
  const c = flatCanvas(256, 256);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 133);
  grd.addColorStop(0.00, 'rgba(4,1,14,0)');
  grd.addColorStop(0.46, 'rgba(4,1,14,0)');
  grd.addColorStop(0.72, 'rgba(4,1,14,0.40)');
  grd.addColorStop(0.92, 'rgba(4,1,14,0.80)');
  grd.addColorStop(1.00, 'rgba(4,1,14,0.86)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  HEM = texOf(c);
  return HEM;
}

/** A soft round glow, for the light welling out of the pile. */
let PILE = null;
function pileTexture() {
  if (PILE) return PILE;
  const c = flatCanvas(128, 128);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0.00, 'rgba(196,164,255,0.92)');
  grd.addColorStop(0.24, 'rgba(136,88,244,0.60)');
  grd.addColorStop(0.58, 'rgba(76,32,176,0.25)');
  grd.addColorStop(1.00, 'rgba(48,18,116,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  PILE = texOf(c);
  return PILE;
}

/**
 * A flat ribbon: a chain of points laid on the ground, `u` along its length and
 * `v` across. kit.strip is the cloth version and takes the light like fabric;
 * the bed is a decal, so it wants a basic material and no normals at all.
 */
function ribbon(segments) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3));
  const uv = new Float32Array(segments * 2 * 2);
  for (let i = 0; i < segments; i++) {
    const u = i / (segments - 1);
    uv[i * 4 + 0] = u; uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = u; uv[i * 4 + 3] = 1;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e3);
  return geo;
}

const UP = new THREE.Vector3(0, 1, 0);
const TAN = new THREE.Vector3(), SIDE = new THREE.Vector3();
function layFlat(geo, pts, width) {
  const pos = geo.attributes.position.array;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    TAN.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]);
    TAN.y = 0;
    if (TAN.lengthSq() < 1e-9) TAN.set(1, 0, 0);
    SIDE.crossVectors(TAN.normalize(), UP).normalize().multiplyScalar(width * 0.5);
    const p = pts[i];
    pos[i * 6 + 0] = p.x - SIDE.x; pos[i * 6 + 1] = p.y; pos[i * 6 + 2] = p.z - SIDE.z;
    pos[i * 6 + 3] = p.x + SIDE.x; pos[i * 6 + 4] = p.y; pos[i * 6 + 5] = p.z + SIDE.z;
  }
  geo.attributes.position.needsUpdate = true;
}

/**
 * The top of the discard pile, measured rather than guessed.
 *
 * The pile is a box scaled by how many cards are in it, so its top is anywhere
 * between 2cm and half a unit, and a fixed height is wrong in both directions
 * — over an empty Graveyard the current starts in thin air and over a big one
 * it starts INSIDE the stack. The pile carries `graveOf` for picking, so it
 * can be found and measured; the pick pad carries the same tag and is an
 * invisible 40cm box, which is why anything not drawn is skipped.
 */
const BOX = new THREE.Box3();
function graveTop(kit, owner) {
  let top = 0.1;
  kit.scene.traverse((o) => {
    if (o.userData?.graveOf !== owner) return;
    if (o.material && o.material.visible === false) return;
    top = Math.max(top, BOX.setFromObject(o).max.y);
  });
  return top;
}

/* --- heights, and none of these three is a free choice --- */

// The flagstone face is 0.080 and a card's slab runs 0.185 to 0.220.
//
// UNDER is voidlink's and voidstep's number: at 0.092 a flat decal does not
// draw AT ALL at this camera — the depth buffer cannot separate a centimetre —
// while one four millimetres higher does. It is also well under a card, which
// is the point: everything at this height is hidden by whatever card is over
// it, and that is what makes the pool read as coming from beneath rather than
// as a decal lying on the board.
const UNDER = 0.118;
// Where the souls run on the way across. NOT at flagstone height, which was
// the obvious choice and is wrong: the squares carry wooden kerbs, the
// Stronghold stands on a plinth, and every flagstone has grass and ivy growing
// over its seams, so a run down there spends half its length behind scenery
// and what is left reads as a broken line rather than as a stream. At 0.40 it
// is still only about ten screen pixels off the stone — height costs about 26
// pixels a world unit here — and nothing on the table cuts it. The statement
// about going UNDER is made by the dive at the end and by the pool, where it
// can actually be seen.
const RUN = 0.40;
// The bed runs with the souls, a few centimetres under them, and NOT on the
// flagstones. Its whole job is to be the dark they are legible against, and
// down there it loses that fight twice over: the same scenery chops the groove
// into pieces, and every card the run crosses hides the groove under exactly
// the card whose art the souls most need to be dark against. The gaps between
// squares are four pixels wide; a shadow drawn down in them is not drawn.
const BED_Y = RUN - 0.05;

// How many souls are launched per world unit of run. A COUNT would be the
// obvious thing and it is wrong: the run is about two units from the near
// squares and seven or more from the far ones, so thirty souls that are a flow
// across the short one are a dotted line across the long one — and a dotted
// line between two points is the tether this was rejected for. Spacing is what
// has to stay fixed. This is the total LAUNCHED, not the number in flight: a
// soul is in the air for a fifth of the run's window, so about a third of them
// are on the table at once.
const PER_UNIT = 12.0;
// How many lanes the braid is woven from. Spread is what keeps a stream of
// small additive sprites off the white smear ACES makes of them — overlap is
// what sums past 1.0, and there is room ACROSS the run, where this camera
// charges nothing for width.
const LANES = 7;
// How long one soul is in the air, in seconds. Nearly constant rather than a
// fixed speed, so the BEAT is the same whether the pile is two units away or
// seven — a fixed speed made the same card feel slow from one end of the board
// and snappy from the other.
//
// IT ALSO HAS TO LAND WELL INSIDE THE LEAD-IN. At 0.20 + reach the first souls
// reached the card at 0.29 and the pool under it was still filling when the
// stone cracked at 0.42 — which is not "the souls arrive first, and the hand
// comes up out of what they fed", it is the two halves happening at once,
// exactly the fault the lead-in was added to fix. Arriving at about 0.22
// leaves a fifth of a second — twice that at drama.js's half speed — of a
// square lit from underneath by something that got there, before anything
// breaks.
const travel = (reach) => 0.15 + Math.min(0.07, reach * 0.011);

/**
 * The whole lead-in: souls off the pile, a groove across the stone, and the
 * pool they feed the square with.
 *
 * Fired from `raise` before anything else, and it owns its own kit.hold so the
 * grave's own tick stays about the grave.
 */
function current(kit, at, p) {
  // `?? 0` for the bare-square case: four of the five cards DEPLOY the
  // fighter, so the piece is normally there by the time this plays, but a
  // Necromancer going into open ground can fire a frame early and a motif that
  // threw here would take the whole raise with it.
  const owner = kit.piece(at)?.owner ?? 0;
  const near = owner === 0 ? 1 : -1;
  const gp = graveyardPosition(owner);

  // The two ends, and note which is which: B is the SOURCE.
  const B = new THREE.Vector3(gp.x, graveTop(kit, owner) + 0.10, gp.z);
  const A = new THREE.Vector3(p.x, UNDER, p.z);
  const flat = new THREE.Vector3(A.x - B.x, 0, A.z - B.z);
  const reach = Math.max(0.6, flat.length());
  // A bow sideways, so the run is a current finding its way rather than a
  // ruler laid between two points. Held small: a wide sweep starts to look
  // like a thrown arc seen from above, which is the thing this replaced.
  const side = new THREE.Vector3(-flat.z, 0, flat.x).normalize();
  const BOW = Math.min(0.55, reach * 0.085) * near;
  // How far off the middle the outermost soul swims. This is what makes the
  // current PLURAL: on one lane thirty souls are beads on a wire, which is a
  // tether with gaps in it. Spread across most of a card's width they are a
  // braid, and a braid can only be many things.
  const lanes = Math.min(0.80, 0.34 + reach * 0.075);

  /**
   * Where the current is at `u` along its run, for a soul swimming `lane`
   * units off the middle of it.
   *
   * It comes up off the pile, crests, drops to the running height and STAYS
   * there. The flat middle is not laziness — an arch is what a thrown thing
   * draws, and the whole complaint about the old motif was that it looked
   * thrown. The last stretch DUCKS to below the card, where the card's own
   * silhouette hides it: the souls are not absorbed by a fade, the card does
   * it, which is the only way "underneath" is ever believable. Once the mouth
   * has opened they are diving into the hole they made.
   */
  const path = (u, out, lane = 0, wob = 0) => {
    const k = Math.min(1, Math.max(0, u));
    out.set(B.x + flat.x * k, 0, B.z + flat.z * k);
    const s = Math.sin(Math.PI * k);
    out.addScaledVector(side, BOW * s + lane * (0.3 + 0.7 * s));
    const w = Math.min(1, k / 0.34);
    out.y = RUN + (B.y - RUN) * (1 - w) ** 1.5 + 0.22 * Math.sin(Math.PI * w) + wob * s;
    const duck = Math.max(0, (k - 0.80) / 0.20);
    out.y -= (RUN - UNDER) * duck * duck * (3 - 2 * duck);
    return out;
  };

  const g = new THREE.Group();

  /* ---- the groove ---- */
  const bedGeo = ribbon(42);
  const bed = new THREE.Mesh(bedGeo, new THREE.MeshBasicMaterial({
    map: bedTexture(), transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide,
  }));
  // BEFORE the souls, explicitly. The bed is near-black and normal-blended and
  // nothing here writes depth, so left behind them in the draw order it is
  // painted straight over the current it exists to set off.
  bed.renderOrder = 2;
  g.add(bed);
  const bedPts = Array.from({ length: 42 }, () => new THREE.Vector3());

  /* ---- the light welling out of the pile ---- */
  const pile = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.2, CARD_H * 1.2),
    new THREE.MeshBasicMaterial({
      map: pileTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  pile.rotation.x = -Math.PI / 2;
  pile.position.set(B.x, B.y - 0.06, B.z);
  g.add(pile);

  /* ---- what the current makes under the square ---- */
  // Neither of these is any use without the other: the ring alone is a violet
  // smudge on warm lit stone, and the hem alone is a card that has gone dim.
  // A CARD IS PART OF THIS QUAD'S DESIGN, so the bare square has to be told.
  // The ring is sized and aimed so that a card's own silhouette covers its
  // middle and only the bright band escapes around the edge; fired on open
  // ground — which four of these five cards can do — there is nothing to cover
  // anything and the whole disc shows, a violet plate two card-widths across
  // and the brightest object on the table during what is only the LEAD-IN.
  // Taken in and taken down when there is no card, which is also the one case
  // where the mouth below it is on the flagstones rather than on a card face.
  const onCard = !!kit.piece(at);
  const poolS = onCard ? 1 : 0.70;
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.62 * poolS, CARD_H * 1.62 * poolS),
    new THREE.MeshBasicMaterial({
      map: poolTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(p.x, UNDER, p.z);
  pool.renderOrder = 1;
  g.add(pool);

  const hem = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.02, CARD_H * 1.02),
    new THREE.MeshBasicMaterial({
      map: hemTexture(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  hem.rotation.x = -Math.PI / 2;
  // only ON a card; over a bare square there is no face to darken and this
  // would be a black rectangle lying on the flagstones
  hem.position.set(p.x, Math.min(p.y, 0.225) + 0.055, p.z);
  hem.renderOrder = 4;
  hem.visible = onCard;
  g.add(hem);

  /* ---- the souls ---- */
  const tr = travel(reach);
  const count = Math.round(Math.min(96, Math.max(30, reach * PER_UNIT)));
  const souls = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: soulTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.renderOrder = 3;
    // WHEN it leaves is spread evenly and scrambled against everything else
    // about it. Seeded purely at random the stream clumps — four souls nose to
    // tail and then a gap — and a clump of additive sprites on one patch of
    // stone is the white pill this is trying not to be. Walked in order
    // instead, the launch time lines up with the lane, which is picked off i
    // modulo LANES, and the current comes out as a regular zigzag. The golden
    // ratio gives an even spread for ANY count, which a fixed coprime stride
    // does not — the count varies with the length of the run.
    const slot = Math.floor(((i * 0.6180339887) % 1) * count);
    souls.push({
      s,
      off: T.WAKE + ((slot + Math.random() * 0.8) / count) * (T.FLOW - T.WAKE),
      dur: tr * (0.86 + Math.random() * 0.3),
      lane: ((i % LANES) / (LANES - 1) - 0.5) * 2 * lanes,
      braid: 2.4 + (i % 3) * 1.3,
      phase: i * 2.39996,
      wob: (Math.random() - 0.5) * 0.10,
      // Six or seven pixels across and twenty long at play distance — a card
      // is sixty across, so a soul is about a tenth of one. Measured off
      // frozen frames in both directions: smaller and the current is a violet
      // scratch, larger and it is smoke.
      w: 0.17 + Math.random() * 0.05,
      len: 0.54 + Math.random() * 0.26,
      // A NARROW RANGE, and that is the fix for the count. Spread 0.46 to
      // 0.92, thirty souls in flight showed up as six: the leaders carried the
      // whole picture and the body of the current sat under the threshold this
      // dark arena puts on a small violet sprite. Every soul has to clear that
      // threshold or it is not in the shoal. The leaders come DOWN to meet the
      // body rather than the body going up, because it is the leaders that
      // would go white where two of them cross.
      lit: i % 9 === 0 ? 0.95 : 0.62 + Math.random() * 0.20,
    });
    g.add(s);
  }

  const pos = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const dir = new THREE.Vector3();

  kit.hold(g, SPAN, (t) => {
    const s = t * SPAN;

    /* ---- the groove: open or shut, never growing ---- */
    // The old motif's line grew out from the card and then shortened, which is
    // the reel. A channel is simply open or shut.
    const on = Math.min(1, Math.max(0, (s - T.WAKE) / 0.14));
    const off = Math.min(1, Math.max(0, (s - T.FLOW) / 0.30));
    const bright = easeOut(on) * (1 - easeIn(off));
    for (let i = 0; i < bedPts.length; i++) {
      path(i / (bedPts.length - 1), bedPts[i]);
      bedPts[i].y = BED_Y;
    }
    // Narrow enough to hug the braid. Wider it is a road: painted flat red to
    // find out what it was actually covering, a bed at lanes*1.7+0.4 turned
    // out to be forty-odd pixels across and over a third of the board.
    layFlat(bedGeo, bedPts, lanes * 1.05 + 0.18);
    bed.material.opacity = 0.85 * bright;

    /* ---- the pile ---- */
    const openP = Math.max(0, Math.min(1, (s - T.WAKE) / 0.12));
    const shutP = Math.max(0, Math.min(1, (s - T.FLOW + 0.10) / 0.28));
    // 0.62 and not 0.9: additive, over a CARD_W*1.2 plate, on top of a face-up
    // pile that is already bright art, the Graveyard went to a solid violet
    // slab and the card coming out of it could not be seen at all.
    pile.material.opacity = 0.62 * easeOut(openP) * (1 - shutP);
    pile.scale.setScalar(0.5 + easeOut(openP) * 0.6 + shutP * 0.3);

    /* ---- the souls ---- */
    for (const m of souls) {
      const k = (s - m.off) / m.dur;
      if (k <= 0 || k >= 1) { m.s.material.opacity = 0; continue; }
      // eased a little at the start so a soul peels off the pile rather than
      // being fired out of it, and flat the rest of the way
      const u = k * (0.82 + 0.18 * k);
      const lane = m.lane + 0.20 * Math.sin(u * m.braid + m.phase);
      path(u, pos, lane, m.wob);
      m.s.position.copy(pos);
      // Turned to point the way it is going, in the CAMERA'S OWN PLANE. The
      // sprite shader scales the quad and then spins it about the view axis,
      // so the direction has to be measured in view space — measured in screen
      // pixels instead it is wrong by the aspect ratio, which at 1.6 tilts
      // every soul by up to fifteen degrees and shows as a stream whose wisps
      // do not lie along it. CAM is the peephole the hand already keeps.
      if (CAM) {
        path(Math.min(1, u + 0.02), ahead, lane, m.wob);
        dir.copy(ahead).sub(pos).transformDirection(CAM.matrixWorldInverse);
        m.s.material.rotation = Math.atan2(-dir.x, dir.y);
      }
      // shrinking as it goes under — the current is being drunk, not stopped.
      // It starts at 0.88 because a card is only about a tenth of a long run
      // across: faded from 0.78 every soul died a card's width SHORT of the
      // square and the current ended in a stripe of bare stone.
      const gone = Math.max(0, (u - 0.88) / 0.12);
      m.s.scale.set(m.w * (1 - gone * 0.55), m.len * (1 - gone * 0.6), 1);
      // The shoal gives way once the hand is through — from BREACH on the
      // hand is the subject and a current still running at full strength
      // across it is competition, not support. 0.75 AND NOT 0.55: this arena
      // puts a hard floor under what a small violet sprite shows at, and at
      // 0.55 the ordinary souls fell straight through it, so instead of
      // receding behind the hand the current simply switched off — the pile
      // was still pouring and there was nothing on the table between it and
      // the grave. Subordinate is not the same as gone, and the difference
      // between them here is about a fifth of the alpha.
      const yield_ = s < T.BREACH ? 1 : 0.75;
      m.s.material.opacity = m.lit * yield_
        * Math.min(1, k * 7) * (1 - easeIn(gone)) * bright;
    }

    /* ---- what they feed ---- */
    // Lit as the first souls ARRIVE — tied to the flow rather than to a moment
    // of its own, so a long run from the far corner and a short one from the
    // next square over both light the square when they get there — and then
    // pulled back as the stone parts, because from OPEN the mouth is the hole
    // and a bright ring around it is a second, competing light source.
    const fed = Math.min(1, Math.max(0, (s - (T.WAKE + tr)) / 0.12));
    const ebb = Math.max(0, Math.min(1, (s - T.FLOW - tr) / 0.30));
    const give = s < T.OPEN ? 1
      : 0.42 + 0.58 * Math.max(0, 1 - (s - T.OPEN) / 0.22);
    const lit = easeOut(fed) * (1 - easeIn(ebb)) * give;
    // Flickering, faintly and fast. A steady glow is a lamp under the card; a
    // glow that stirs is something pouring into it.
    const stir = 1 + 0.09 * Math.sin(s * 47) + 0.05 * Math.sin(s * 29 + 1.7);
    pool.material.opacity = (onCard ? 0.64 : 0.44) * lit * stir;
    pool.scale.setScalar(0.88 + 0.16 * lit);
    // the hem hands over to the mouth's own dark rather than stacking with it
    hem.material.opacity = 0.85 * easeOut(fed) * (1 - easeIn(ebb))
      * Math.max(0, 1 - Math.max(0, (s - T.CRACK) / (T.OPEN - T.CRACK)));
  });

  // Light at both ends and NOWHERE IN BETWEEN: the braziers are low and a
  // seven-unit run lit along its whole length washes the board out.
  kit.after(T.WAKE, () => {
    // 10, not 15. The plate above and this lamp are the same colour in the
    // same place, so at full the pile got lit twice.
    kit.light(B, 0x7c4ae0, { power: 10, seconds: 0.5, reach: 4.0 });
  });
  // ...and the one at the square sits BELOW the card's face on purpose. A
  // point light under a flat card cannot light the face at all — the face's
  // normal points away from it — so all it reaches is the slab's edges and the
  // stone around the square, which is exactly the light the ring is painting.
  // Put a few hundredths ABOVE the card instead it blows the whole face white,
  // which is the failure the lights at the foot of this file already record.
  //
  // 2.4, AND IT IS MEASURED AGAINST WHAT COMES AFTER IT. The lamps at the foot
  // of this file are 2.1 at the crack and 3.0 at the breach; carried straight
  // over from harvest.js, where this is the whole payoff, this one was 5.0 and
  // the LEAD-IN was the brightest moment in the motif — the square blazed,
  // then the stone broke to something dimmer, which builds the effect
  // backwards. The current is the preparation, not the event.
  kit.after(T.WAKE + tr, () => {
    kit.light(new THREE.Vector3(p.x, UNDER + 0.02, p.z), 0x8a58f0,
      { power: 2.4, seconds: T.CRACK - (T.WAKE + tr) + 0.3, reach: 2.6 });
  });
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
  // The HAND is not turned at random and is not turned by the dice either: it
  // is aimed at the camera every frame, from the camera's own position (see
  // `peep`). All that is rolled here is how far OFF square it stands, so two
  // raises are never the same and none of them is a posed photograph.
  const handSkew = (Math.random() - 0.5) * 0.85;
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
  // `peep` needs a mesh that is on screen from the first frame to hand it the
  // camera, and the seams are it. Set on the object, not the material: the
  // materials here are per-cast but a map is shared for the life of the page.
  seamDark.onBeforeRender = peep;

  // Which way the arm leans, in the hand's own frame — ACROSS the view, not
  // toward it. A forearm leaning toward the lens is foreshortened to a stub;
  // leaning across, its whole length is on screen. The small +Z is what keeps
  // it from being a flat cut-out.
  const armSide = Math.random() < 0.5 ? -1 : 1;
  const armDir = new THREE.Vector3(Math.sin(0.30) * armSide, Math.cos(0.30), 0.12).normalize();
  const hand = skeletalHand({
    armDir,
    // laid back to meet a lens 46 degrees above the table — a few degrees shy
    // of square, so it reads as reaching rather than as posed for a photograph
    tilt: 0.76 + Math.random() * 0.10,
    roll: (Math.random() - 0.5) * 0.30,
    // The thumb goes to the side the ARM does not. Rolled independently they
    // came up together about half the time, and the thumb then lay along the
    // forearm and read as a second one.
    side: -armSide,
  });
  // A pivot at the mouth, and the hand rides OUT ALONG THE ARM from it. That
  // is the whole reason for the extra group: put at base + (armDir * s), the
  // line the forearm runs down passes through the middle of the mouth at every
  // height it is ever drawn at, so the arm is never seen leaving the hole from
  // one side of it. The obvious version — move it straight up, lean it over —
  // has the hand drifting off the hole as it rises.
  const pivot = new THREE.Group();
  const rig = new THREE.Group();
  pivot.add(rig);
  rig.add(hand.group);

  /**
   * A lamp of the hand's own, and it earns its keep at ONE of the two seats.
   *
   * The arena's key is a single spot at a fixed corner of the world. From the
   * near seat it falls on the face of the hand and the bone models beautifully;
   * from the far seat the same lamp is BEHIND the hand and every surface the
   * player can see is a shadow side — measured, the hand went from reading at
   * a glance to a grey smudge in the hole, and nothing about the geometry was
   * wrong. So this rides on the pivot, which faces the lens, and is therefore
   * always over the viewer's shoulder.
   *
   * It is scaled by how much of the key is ALREADY doing that job, so at the
   * near seat it is nearly off and only the far seat pays for it. The sun is
   * found in the scene rather than written down here, because a number copied
   * out of arena.js is a number that goes stale in silence.
   */
  const sun = kit.scene.children.find((o) => o.isSpotLight);
  const KEY = sun ? sun.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
  const lamp = new THREE.PointLight(0xc3b0ff, 0, 2.6, 2);
  // up, over the left shoulder, and in FRONT — the same bearing the shading is
  // baked from, so the two agree instead of cancelling
  lamp.position.set(-0.38, 0.86, 0.92);
  pivot.add(lamp);
  const toCam = new THREE.Vector3();
  // Distances ALONG THE ARM, measured against the mouth. The hand stands about
  // 0.5 above the wrist once it is laid back, so DEEP buries the lot, TIPS is
  // the moment the finger ends are level with the stone, and HIGH leaves the
  // wrist and a little forearm clear of it.
  const DEEP = -1.30, TIPS = -0.52, HIGH = 0.33;
  kit.hold(pivot, SPAN, (t) => {
    const s = t * SPAN;
    let d;
    if (s < T.OPEN) d = DEEP;
    else if (s < T.BREACH) {
      // stirring in the dark under the mouth, mostly hidden by it
      d = DEEP + (TIPS - DEEP) * easeIn((s - T.OPEN) / (T.BREACH - T.OPEN));
    } else if (s < T.CREST) {
      const k = (s - T.BREACH) / (T.CREST - T.BREACH);
      // thrown up hard and pulled short — the arm runs out of reach rather
      // than gliding to a stop
      d = TIPS + (HIGH - TIPS) * easeOut(k) + 0.05 * Math.sin(k * Math.PI) ** 2;
    } else if (s < T.SINK) {
      // holding, shaking with the effort
      d = HIGH + 0.012 * Math.sin((s - T.CREST) * 34);
    } else {
      // Dragged back down, and CLEAR of the mouth by GONE — from there the
      // mouth starts closing and stops covering what is below it. On a cube
      // ease the claws were still a third of a card above the stone when the
      // hole had shrunk out from under them, and the tips hung over the card
      // art with nothing holding them, which looked like a bug and was one.
      const k = Math.min(1, (s - T.SINK) / (T.GONE - T.SINK));
      d = HIGH + (DEEP - HIGH) * (k * k * 0.68 + k * 0.32);
    }
    rig.position.copy(armDir).multiplyScalar(d);
    pivot.position.copy(base);
    pivot.position.y += heave(s);
    // Turned to face the lens. Without this the hand is a fan seen edge-on
    // from one of the two seats, which is exactly what killed the first build
    // — and the shake at the crest is put in HERE, as a twist, because a hand
    // holding at full reach shivers about its own wrist rather than bouncing.
    const shake = s > T.CREST && s < T.SINK ? 0.02 * Math.sin((s - T.CREST) * 41) : 0;
    pivot.rotation.y = (CAM
      ? Math.atan2(CAM.position.x - base.x, CAM.position.z - base.z)
      : 0) + handSkew + shake;
    // ...and the fill, which is only really on at the far seat (above)
    if (CAM) {
      toCam.copy(CAM.position).sub(base).normalize();
      lamp.intensity = 2.3 * (1 - Math.max(0, toCam.dot(KEY)) ** 1.5)
        * Math.min(1, Math.max(0, (d - TIPS) / 0.5));
    }
    // The light in the throat rakes across it as it passes the mouth. The
    // range has to STRADDLE the value the material was tuned at — set to
    // 0.55..1.10 here it quietly overrode the value chosen against a
    // screenshot every single frame, and the bone was back to white plastic
    // with no clue in the material why.
    hand.bone.emissiveIntensity = 0.24 + 0.26 * Math.max(0, 1 - Math.abs(d) * 1.4);
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

  /* ---- the souls arrive, and the ground breaks over what they fed ---- */
  // FIRST, and that ordering is the motif. Before this the hand simply
  // arrived: a grave opened on a square that had nothing to do with the
  // Graveyard, and where the fighter was coming back FROM was not in the
  // picture at all. Everything from CRACK on is unchanged in shape and shifted
  // 0.26 later to pay for this, and that lead-in is not padding — the current
  // has to be seen leaving the pile, crossing, and going under the card before
  // the stone gives way, or the two halves read as two effects that happened
  // to fire together. It is aimed at `p` and not at `base`: the pool belongs
  // under the card, not on the plane the mouth is cut into.
  current(kit, at, p);

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
