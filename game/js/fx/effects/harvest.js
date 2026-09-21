// HARVEST — the discard pile gives up its dead, and they come to you: a
// current of souls runs low across the flagstones from the pile and goes into
// the ground UNDERNEATH the fighter. What they carry surfaces there, through
// the card, and leaves for your hand.
//
// Shared by 3 cards: The Lich (R067), Empty Crypt (R074), Undead Horde (C086).
// One motif, one file — worked on on its own.
//
// THE DRAG IS GONE AND IT IS NOT COMING BACK.
//
// What stood here was a strap of grave-wrapping whipped out of the card,
// across the table to the discard pile, biting it, and REELING a card-shaped
// prize home along a long lit diagonal. It was rejected: "should be more souls
// channeling from the discard to underneath them. This gets rid of the messy
// click and drags." That is the whole diagnosis. A line thrown across a table
// that grabs a thing and hauls it back is A MOUSE DRAGGING AN ICON whatever it
// is painted as — it is mechanical in a faction whose entire subject is the
// dead, and it made the CARD the actor and the graveyard a target, which is
// backwards. Nobody reaches into a grave in this faction. The dead come.
//
// So everything runs ONE WAY now, pile to card, and what travels is not an
// object but a CURRENT: many small souls, launched staggered so there is
// always a line of them on the table, running LOW over the stone and ducking
// under the card at the end of it. Nothing is thrown, nothing grips, nothing
// is pulled, and no part of this motif ever travels from the card toward the
// pile.
//
// The three things that make it read, at sixty pixels a card:
//   - PLURAL. One bright thing crossing a table is a projectile; a chain of
//     dim ones with dark between them is a flow. About thirty souls are on the
//     table at once across a long run, woven over seven lanes, each about a
//     tenth of a card long — and they all sit in a narrow band of brightness,
//     because the ones that fall below what this dark arena will show are not
//     in the shoal at all and the current goes back to being a few bright
//     beads on a wire, which is the tether. What keeps a stream of many small
//     bright things off the white smear ACES makes of them is not dimness but
//     SEPARATION: they are spread across the lanes, where this camera charges
//     nothing for width, and they burn against a near-black bed rather than
//     against lit stone.
//   - LOW. The old line arched over the table, which is what flying looks
//     like. This one drops off the pile and runs flat a hand's breadth over
//     the stone — see RUN and BED_Y for why not ON it — and the statement
//     about being underneath is made where it can be seen, by the dive at the
//     end and by the glow under the card.
//   - UNDERNEATH. The current ends at the card's centre at flagstone height,
//     where the card's own silhouette hides it, and a violet glow sits on the
//     stone BELOW the card so only a fringe of it shows around the card's
//     edge. A card lit by something under it is the picture the whole thing is
//     for, and it costs one quad at a height the card already covers.
//
// What it must still not be:
//   - the Gloaming flourish (cast-gloaming.js) is motes SINKING into a card.
//     These come off the pile and run sideways; nothing here falls.
//   - raise.js is a body CLIMBING OUT onto a square. Nothing lands here. The
//     prize leaves the table on the player's side, because it is going to hand.
//   - phylactery.js catches ONE soul in a lantern. This is the same world and
//     the same pale-head, violet-tail wisp — but a whole current of them, and
//     nothing catches these.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=400" \
//             --eval tools/fxdemo/harvest.js --out /tmp/h-400.png --settle 700
// where ?t is the moment in the MOTIF to freeze at, in milliseconds, and the
// harness also takes ?sq (which square casts it — the reach from the near
// squares is about two units and from the far ones seven or more), ?grave (how
// tall the pile is, which is where the current starts) and ?side (which player
// casts it, which offline is also which chair — the harness explains why those
// two cannot be prised apart). All four change what this looks like and all
// four were got wrong at some point.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { graveyardPosition } from '../../board.js';

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map.
const TEXES = new Map();
function tex(key, make) {
  let t = TEXES.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(make());
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

/**
 * One soul: a small pale head with a violet tail widening out behind it, head
 * at the TOP of the canvas.
 *
 * It is drawn ROW BY ROW rather than as two crossed gradients, because the
 * taper is the whole picture. Crossed gradients give a capsule — the same
 * width end to end, bright along its length — and a capsule has no direction
 * in it, so a frozen frame of thirty of them is a handful of glowing pills
 * lying on the board. A comet says which way it is going before it moves,
 * which is what turns particles into a current.
 *
 * THE ALPHA WAS THE WHOLE FIGHT AND IT WENT THE WRONG WAY FIRST. Painted with
 * a head three pixels long and a tail at a tenth alpha — on the theory that
 * anything more would sum to a white smear — thirty souls crossing the table
 * were INVISIBLE in every shot, while the same sprites filled with flat green
 * to prove they were being drawn at all were large and obvious. The lesson is
 * the one this camera keeps teaching: a sub-pixel detail is an absent detail,
 * and a soul whose bright part is four pixels of a thirty-pixel streak has no
 * bright part. It then went too far the other way twice — see the notes on the
 * head's WIDTH and on the cross-section below, which are the two places that
 * mistake was actually hiding.
 *
 * The white smear is held off somewhere else instead, where it costs nothing:
 * the souls are SPREAD — across seven lanes and down the whole run — so two of
 * them almost never share a pixel, and there is a near-black bed under them.
 * Overlap is what sums past 1.0, not brightness on its own.
 *
 * Bone at the head and grave-violet down the tail, red held DOWN the whole
 * way. Pale lilac is the same trap cast-gloaming and raise both name: any pale
 * colour, additive, comes out of the filmic curve as white.
 */
const soulMap = () => tex('soul', () => {
  const W = 64, H = 160;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  // Held well off white. At (236,224,255) the heads came out of ACES as PALE
  // GREY SCRATCHES lying on the stone — legible, and belonging to no faction
  // on this table; the Gloaming look is the absence of light, and nothing in
  // it is allowed to be the brightest thing in frame. Red is held down and
  // blue held up all the way along, which is what reads as cold.
  const HEAD = [184, 158, 255], MID = [124, 76, 234], TAIL = [54, 20, 140];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    // THE HEAD USED TO BE THE NARROWEST PART OF THE SPRITE AND THAT IS WHY
    // NONE OF THIS COULD BE SEEN. It opened from 0.30 of the canvas at the
    // head out to 0.92 down the tail — textbook comet, and backwards for this
    // camera, because the alpha peaks at the head too. The only full-strength
    // pixels in a soul were therefore a spike about two pixels across inside a
    // seven-pixel sprite, while everything WIDE about it was the dim end of
    // the tail. Painted flat green to prove they were drawing, sixteen souls
    // were large, obvious and perfectly placed across the board; rendered
    // properly the same sixteen were four faint smudges. Nothing was wrong
    // with the count, the spacing, the bearing or the run — the bright part
    // was sub-pixel, which is the same absent detail this camera has taught
    // every other file in here.
    //
    // So the head is a BULB now: already half the canvas wide where the alpha
    // peaks, opening a little more behind it and then fraying. The taper that
    // gives the soul its direction is still there, it is just no longer paid
    // for out of the one part that has to be seen.
    const half = (W / 2) * (0.50 + 0.46 * Math.min(1, (v * 2.2) ** 0.6));
    // rounded off over the first few rows so the head is a bright cap rather
    // than a cut end, and then dying away down the tail
    const a = Math.min(1, v * 5.5) * (1 - v) ** 1.0;
    if (a <= 0.002) continue;
    const k = Math.min(1, v * 1.7);
    const col = k < 1
      ? HEAD.map((x, i) => Math.round(x + (MID[i] - x) * k))
      : MID.map((x, i) => Math.round(x + (TAIL[i] - x) * Math.min(1, (v - 0.45) / 0.55)));
    const grd = g.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
    const rgb = `${col[0]},${col[1]},${col[2]}`;
    // A SHORT PLATEAU ACROSS THE MIDDLE, not a spike and not a bar. The
    // original stops put full alpha on the centre line alone and 0.55 of it a
    // sixth of the way out, so even where the sprite was wide the solid part
    // of it was one column of pixels — invisible. Opened right out to half the
    // width at near-full instead, the souls went the other way and became FLAT
    // PALE BARS: a soul with no falloff across it has no spine, three of them
    // near each other merge into one shape, and the current came out as four
    // fat lilac smoke strokes rather than a shoal. A third of the width at
    // full, falling away over the rest, gives each soul a core that survives
    // at play size and edges that stay dark enough to keep it separate from
    // its neighbour.
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
  return c;
});

/**
 * The bed: a near-black band the current runs down.
 *
 * The contrast in this motif is BOUGHT WITH DARK, the way every other Gloaming
 * file on this table buys it. The souls are dim on purpose; what makes them
 * legible is that the stone under them is darker than stone. Brightening them
 * instead was tried on the ribbon this file used to carry and the result was a
 * violet bar that was the loudest object in the frame.
 *
 * Feathered hard at the selvedges and darkest just off centre, so it reads as
 * a groove the light is running along and not as a rectangle of shadow.
 *
 * IT FADES OUT AT BOTH ENDS TOO, and it did not before. Uniform along its
 * length it was fine while it lay on the stone at flagstone height, where its
 * ends were hidden under the pile and under the card; lifted to run with the
 * souls (see BED_Y) it is drawn OVER whatever it crosses, and a hard-cut dark
 * rectangle appearing in mid-air over a card face is a rendering fault, not a
 * shadow.
 */
const bedMap = () => tex('bed', () => {
  const N = 64;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  // across the width: a groove, darkest just off centre
  const grd = g.createLinearGradient(0, 0, 0, N);
  grd.addColorStop(0.00, 'rgba(6,2,16,0)');
  grd.addColorStop(0.22, 'rgba(6,2,16,0.52)');
  grd.addColorStop(0.50, 'rgba(4,1,12,0.86)');
  grd.addColorStop(0.78, 'rgba(6,2,16,0.52)');
  grd.addColorStop(1.00, 'rgba(6,2,16,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  // along the length: away to nothing at the pile end and at the card end, so
  // the groove has no ends
  g.globalCompositeOperation = 'destination-in';
  const len = g.createLinearGradient(0, 0, N, 0);
  len.addColorStop(0.00, 'rgba(0,0,0,0)');
  len.addColorStop(0.16, 'rgba(0,0,0,1)');
  len.addColorStop(0.84, 'rgba(0,0,0,1)');
  len.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = len;
  g.fillRect(0, 0, N, N);
  return c;
});

// THERE IS NO CONTINUOUS LIT LINE DOWN THE MIDDLE OF THE BED, and there was
// one for the first build of this. The idea was to bind thirty separate souls
// into one current. What it actually drew, at play size, was a THIN VIOLET
// LINE RUNNING FROM THE PILE TO THE CARD — which is the exact object this
// motif was rejected for, rebuilt in a dimmer colour. Anything continuous and
// lit between those two points reads as a tether no matter how faint it is.
// The souls have to carry the current on their own, and what binds them is
// that there are always enough of them on the table at once.

/**
 * The glow that sits UNDER the card: an annulus, not a disc.
 *
 * It is laid on the stone at flagstone height, so the card covers its middle
 * and only the outer ring escapes around the card's own edge. A disc would
 * waste all its brightness where nothing can see it and then have nothing left
 * at the rim; a ring puts the light exactly where the card's silhouette ends,
 * which is what "lit from underneath" looks like from a camera fifty degrees
 * above the table.
 */
const underMap = () => tex('under', () => {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  // The bright band is at 0.74 of the radius and NOT at 0.58, and the
  // difference is the whole quad. The plate is CARD_W*1.62 across, so its half
  // width is 1.41 units against a card's 0.87: a ring peaking at 0.58 peaks at
  // 0.82 units out, which is INSIDE the card's own footprint, where the card
  // covers it. All its light went under the card and the fringe that escaped
  // was the dying outer skirt. At 0.74 the bright band lands just past the
  // card's edge and the skirt falls away on the stone outside it.
  // AND IT IS HELD OFF WHITE. At (184,148,255) on the bright band, additive,
  // at 0.80 on top of the lamp underneath it, the ring round the card measured
  // three hundred clipped pixels and read PINK — the loudest, warmest thing on
  // a table whose whole Gloaming look is cold and dim. ACES pulls about a
  // third of the green into the red, so a lilac that looks correct on the
  // canvas comes out of the curve as blossom. Blue held up, green and red
  // both pulled down, and the alpha off the ceiling.
  grd.addColorStop(0.00, 'rgba(104,58,214,0.10)');
  grd.addColorStop(0.46, 'rgba(112,62,224,0.22)');
  grd.addColorStop(0.62, 'rgba(126,80,240,0.52)');
  grd.addColorStop(0.74, 'rgba(152,120,252,0.88)');
  grd.addColorStop(0.86, 'rgba(98,48,214,0.30)');
  grd.addColorStop(1.00, 'rgba(62,24,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return c;
});

/**
 * The hem: dark drawn inward from the card's own border, nothing in the
 * middle.
 *
 * The ring of light above is on the STONE, which is warm and lit, and a violet
 * fringe on warm lit stone is a smudge. This goes on the card FACE and gives
 * the fringe something black to burn against on its inner side — the card's
 * edge goes dark, the stone just outside it goes cold and bright, and the
 * boundary between them is the whole read. Alpha 0 through the middle so the
 * art and the badges are untouched. (voidlink.js found this; it is the same
 * trick and the same reason.)
 */
const hemMap = () => tex('hem', () => {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 133);
  grd.addColorStop(0.00, 'rgba(4,1,14,0)');
  grd.addColorStop(0.46, 'rgba(4,1,14,0)');
  grd.addColorStop(0.72, 'rgba(4,1,14,0.40)');
  grd.addColorStop(0.92, 'rgba(4,1,14,0.80)');
  grd.addColorStop(1.00, 'rgba(4,1,14,0.86)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return c;
});

/** A soft round glow, for the mouth that opens in the pile. */
const haloMap = () => tex('halo', () => {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0.00, 'rgba(206,176,255,0.95)');
  grd.addColorStop(0.24, 'rgba(140,92,246,0.62)');
  grd.addColorStop(0.58, 'rgba(78,34,178,0.26)');
  grd.addColorStop(1.00, 'rgba(50,20,120,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
});

/**
 * The prize: a card-shaped hole in the light, with a cold rim.
 *
 * A CARD is the one silhouette this game has taught the player to read, so the
 * thing being retrieved is card-shaped and nothing else — at sixty pixels a
 * rectangle with a lit edge is unmistakable, where a blob of light is just
 * another spark.
 */
const prizeMap = () => tex('prize', () => {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const round = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  // NEAR-BLACK, and normal-blended. Additive was the first try and it came out
  // of ACES tone mapping as a white slab with no faction and no edges — over
  // lit card art it was a lens flare, and the one thing it stopped reading as
  // was a card. Bringing the dark instead makes the prize a hole in the shape
  // of a card crossing a warm stone floor, which is legible against everything
  // on this table and is what Gloaming looks like.
  round(22, 22, 212, 212, 16);
  const body = g.createLinearGradient(0, 22, 0, 234);
  body.addColorStop(0.00, 'rgba(24,10,50,0.88)');
  body.addColorStop(0.55, 'rgba(9,3,22,0.82)');
  body.addColorStop(1.00, 'rgba(16,6,38,0.72)');
  g.fillStyle = body;
  g.fill();
  // the rim, twice: a wide soft one that carries across the table and a tight
  // bright one that keeps the corners square when it is close
  g.strokeStyle = 'rgba(104,62,196,0.52)';
  g.lineWidth = 18;
  round(22, 22, 212, 212, 16); g.stroke();
  g.strokeStyle = 'rgba(176,138,252,0.92)';
  g.lineWidth = 4.5;
  round(22, 22, 212, 212, 16); g.stroke();
  // and a cold sheen inside the top edge, so the black has a surface
  g.save();
  round(30, 30, 196, 196, 12); g.clip();
  const sheen = g.createLinearGradient(0, 30, 0, 140);
  sheen.addColorStop(0, 'rgba(132,94,224,0.30)');
  sheen.addColorStop(1, 'rgba(132,94,224,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 256, 256);
  g.restore();
  return c;
});

/* ------------------------------------------------------------- geometry */

/**
 * A flat ribbon: a chain of points laid on the ground, `u` along its length and
 * `v` across. kit.strip is the cloth version of this and takes the light like
 * fabric; the bed and the channel are decals, so they want a basic material
 * and no normals at all.
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
 * The camera, borrowed from the first thing this motif draws.
 *
 * A sprite cannot be turned to face the way it is going in three dimensions,
 * but it CAN be spun in the camera's own plane — and that is all a comet
 * needs. The souls' direction of travel changes with the seat, with which
 * square cast it and with where along the run the soul is, so a baked-in
 * direction (which is what cast-gloaming and raise do, and are right to do,
 * because their dust only ever goes straight up or straight down) would point
 * the wrong way in most of the cases this motif has.
 *
 * Nothing in kit hands a motif the camera, so the bed — which is on screen
 * from the first frame — is used as a peephole. Checked for a perspective
 * camera because the shadow pass renders from the sun's, and souls that turned
 * to face that would spin once a frame.
 */
let CAM = null;
const peep = (renderer, scene, cam) => { if (cam.isPerspectiveCamera) CAM = cam; };

/**
 * The top of the discard pile, measured rather than guessed.
 *
 * The pile is a box scaled by how many cards are in it, so its top is anywhere
 * between 6cm and half a unit. A fixed height was wrong in both directions —
 * over an empty Graveyard the current started in thin air, and over a big one
 * it started INSIDE the stack. The pile carries `graveOf` for picking, so it
 * can simply be found and measured; the pick pad carries the same tag and is
 * an invisible 40cm box, which is why anything not drawn is skipped.
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

/* --------------------------------------------------------------- heights */

// The flagstone face is 0.080 and a card's slab runs 0.185 to 0.220.
//
// UNDER is voidlink's and voidstep's number and it is not a free choice: at
// 0.092 a flat decal does not draw AT ALL at this camera — the depth buffer
// cannot separate a centimetre — while one four millimetres higher does. It is
// also well under a card, which is the entire point here: everything at this
// height is hidden by whatever card is over it, and that is what makes the
// glow read as coming from beneath rather than as a decal lying on the board.
const UNDER = 0.118;
// Where the souls run on their way across.
//
// It was 0.20 first — flagstone height, so that every card in the way would
// occlude the current and the occlusion would be the depth cue. It does not
// survive contact with the board: the squares carry wooden kerbs, the
// Stronghold stands on a plinth, and every flagstone has grass and ivy growing
// over its seams, so the run spent half its length behind scenery and what was
// left read as a broken line rather than as a stream. At 0.40 it is still only
// about eight screen pixels off the stone — height costs 26 pixels a world
// unit here — and nothing on the table cuts it. The statement about being
// underneath is made by the DIVE at the end and by the glow under the card,
// where it can actually be seen, and not by hiding the whole journey.
const RUN = 0.40;
// The bed runs with the souls, a few centimetres under them, AND NOT ON THE
// FLAGSTONES, which is where it was and where it did precisely nothing.
//
// Its whole job is to be the dark the souls are legible against. Laid at
// flagstone height it lost that fight twice over: the same kerbs, plinth and
// ivy that forced the souls up to RUN chopped the groove into pieces, and
// every card the run crossed — which is most of them, this is a motif about
// reaching across a board — hid the groove under exactly the card whose art
// the souls most needed to be dark against. The gaps between squares are four
// pixels wide; a shadow drawn down in them is not drawn at all. So it is
// lifted to just under the souls, where it darkens the card faces and the
// kerbs the current passes over, which is the only place the contrast is worth
// anything.
const BED_Y = RUN - 0.05;
// Anything flat that must survive ON a card face. kit.at answers about 0.2 for
// a card whose face is at 0.21, and at under about +0.05 the depth test fails
// on equal and the card itself is the one place nothing appears.
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

/* ----------------------------------------------------------------- time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. This is a rare motif —
// three cards — so it can afford to be a sentence rather than a word, but the
// UI is held while it runs and that is the ceiling.
const SPAN = 1.3;
const WAKE = 0.05;        // the pile opens and the first souls come off it
const FLOW_END = 0.62;    // the last soul leaves the pile
const SURFACE = 0.46;     // the prize starts up through the card
const HOME = 0.78;        // it hangs over the card, and then goes to hand
const SEG = 42;           // ribbon segments
// How many souls are on the table at once, in souls per world unit of run.
//
// A COUNT would be the obvious thing and it is wrong, because the run is two
// units from the near-right square and nine from the far corner: thirty souls
// that are a flow across the short one are a dotted line across the long one,
// and a dotted line between two points is the tether this motif was rejected
// for. Spacing is what has to stay fixed.
//
// This is the TOTAL launched per unit, not the number in flight: a soul is in
// the air for about a fifth of the motif and they launch over rather more than
// half of it, so under a third of them are on the table at any one moment. At
// 6.4 that was sixteen souls over a seven-unit run — counted off a frozen
// frame — and sixteen is not a current, it is a handful of wisps. Nine gives
// about twenty-four, one every seven or eight screen pixels of run, which
// reads continuous. It buys that without risking the white smear because they
// are spread over SEVEN lanes now rather than five: overlap is what sums past
// 1.0, and the room to put souls is ACROSS the run, where this camera charges
// nothing for width.
const PER_UNIT = 12.0;
// How many lanes the braid is woven from. Seven and not five — see above.
const LANES = 7;

// How long one soul is in the air, as a fraction of the motif. Nearly constant
// rather than a fixed speed, so the BEAT is the same whether the pile is two
// units away or seven — the reach from the far corner is three times the reach
// from the near-right square, and a fixed speed made the same card feel slow
// from one end of the board and snappy from the other. The souls just travel
// faster when they have further to go, which is what a current does.
const travel = (span) => 0.13 + Math.min(0.09, span * 0.012);

export function harvest(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const owner = kit.piece(at)?.owner ?? 0;
  const near = owner === 0 ? 1 : -1;          // which way the player's hand is
  const gp = graveyardPosition(owner);

  // The two ends, and note which is which: B is the SOURCE. Everything in this
  // file runs from the pile to the card and nothing runs the other way.
  const B = new THREE.Vector3(gp.x, graveTop(kit, owner) + 0.10, gp.z);
  const A = new THREE.Vector3(p.x, UNDER, p.z);

  const flat = new THREE.Vector3(A.x - B.x, 0, A.z - B.z);
  const reach = Math.max(0.6, flat.length());
  // A bow sideways, so the run is a current finding its way and not a ruler
  // laid between two points. Held small — a wide sweep starts to look like a
  // thrown arc seen from above, which is the thing this replaced.
  const side = new THREE.Vector3(-flat.z, 0, flat.x).normalize();
  const BOW = Math.min(0.55, reach * 0.085) * near;
  // How far off the middle the outermost soul swims. This is what makes the
  // current PLURAL: on one lane thirty souls are beads on a wire, which is a
  // tether with gaps in it and is the shape that got rejected. Spread across
  // most of a card's width they are a braid, and a braid can only be many
  // things — there is no single object it could be mistaken for.
  const lanes = Math.min(0.80, 0.34 + reach * 0.075);

  /**
   * Where the current is at `u` along its run, for a soul swimming `lane`
   * units off the middle of it.
   *
   * It comes UP off the pile, crests, drops onto the flagstones and then STAYS
   * there. That flat middle is not laziness — an arch is what a thrown thing
   * draws, and the whole complaint about the old motif was that it looked
   * thrown. Height also costs about 26 screen pixels a world unit at this
   * camera while width costs nothing, so a long flat run is the cheap
   * direction as well as the right one.
   */
  const path = (u, out, lane = 0, wob = 0) => {
    const k = Math.min(1, Math.max(0, u));
    out.set(B.x + flat.x * k, 0, B.z + flat.z * k);
    const s = Math.sin(Math.PI * k);
    // the lanes braid together and close up at both ends, so thirty souls
    // leave one pile and arrive under one card without ever being a rope
    out.addScaledVector(side, BOW * s + lane * (0.3 + 0.7 * s));
    const w = Math.min(1, k / 0.34);
    out.y = RUN + (B.y - RUN) * (1 - w) ** 1.5 + 0.22 * Math.sin(Math.PI * w)
      + wob * s;
    // and the last stretch DUCKS: down to flagstone height, where the card
    // standing over it hides it. The souls are not absorbed by a fade — the
    // card does it, which is the only way "underneath" is ever believable.
    const duck = Math.max(0, (k - 0.80) / 0.20);
    out.y -= (RUN - UNDER) * duck * duck * (3 - 2 * duck);
    return out;
  };

  const g = new THREE.Group();

  /* ---- the bed and the channel running down it */
  const bedGeo = ribbon(SEG);
  const bed = new THREE.Mesh(bedGeo, new THREE.MeshBasicMaterial({
    map: bedMap(), transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide,
  }));
  // BEFORE THE SOULS, AND IT WAS AFTER THEM. The bed is near-black and
  // normal-blended and nothing here writes depth, so at renderOrder 2 against
  // sprites left on the default 0 it was painted straight over the current it
  // exists to set off — sixty pixels of black laid on top of every soul it
  // overlapped. The groove has to be under them in the draw order as well as
  // in the fiction; the souls are given an explicit order below rather than
  // left on the default, so this cannot drift back.
  bed.renderOrder = 2;
  // the peephole: this is the one mesh that is on screen from the first frame
  bed.onBeforeRender = peep;
  g.add(bed);

  const bedPts = Array.from({ length: SEG }, () => new THREE.Vector3());

  /* ---- the cold light welling out of the pile */
  const mouth = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.2, CARD_H * 1.2),
    new THREE.MeshBasicMaterial({
      map: haloMap(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.set(B.x, B.y - 0.06, B.z);
  g.add(mouth);

  /* ---- what the current does when it gets there */
  // The ring of light on the stone UNDER the card, and the dark hem on the
  // card face just inside it. Neither is any use without the other: the ring
  // alone is a violet smudge on warm lit stone, and the hem alone is a card
  // that has gone dim.
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.62, CARD_H * 1.62),
    new THREE.MeshBasicMaterial({
      map: underMap(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.set(p.x, UNDER, p.z);
  under.renderOrder = 1;
  g.add(under);

  const hem = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.02, CARD_H * 1.02),
    new THREE.MeshBasicMaterial({
      map: hemMap(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  hem.rotation.x = -Math.PI / 2;
  hem.position.set(p.x, flatY(p), p.z);
  hem.renderOrder = 4;
  g.add(hem);

  /* ---- the prize */
  // Smaller than a real card on purpose. At full size it landed exactly over
  // the card it came out of, edge for edge, and stopped being an object at all
  // — the motif read as "that card lit up" instead of "something came back".
  const prize = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 0.7, CARD_H * 0.7),
    new THREE.MeshBasicMaterial({
      map: prizeMap(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  prize.rotation.order = 'YXZ';
  prize.rotation.y = owner === 0 ? 0 : Math.PI;
  prize.rotation.x = -Math.PI / 2;
  prize.renderOrder = 5;
  g.add(prize);

  /* ---- the souls */
  const tr = travel(reach);
  const count = Math.round(Math.min(96, Math.max(30, reach * PER_UNIT)));
  const souls = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: soulMap(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // OVER the bed, explicitly. Left on the default 0 the near-black groove
    // was drawn after them and wiped them out; see the note on bed.renderOrder.
    s.renderOrder = 3;
    // WHEN it leaves is spread evenly and scrambled against everything else
    // about it. Seeded purely at random the stream clumps — four souls nose to
    // tail and then a gap — and a clump of additive sprites on one patch of
    // stone is the white pill this motif is trying not to be. Walked in order
    // instead, the launch time lines up with the lane, which is picked off i
    // modulo five, and the current comes out as a regular zigzag. The golden
    // ratio gives an even spread for ANY count, which a fixed coprime stride
    // does not — the count varies with the length of the run, and 13 against a
    // count of 52 collapses to four slots.
    const slot = Math.floor(((i * 0.6180339887) % 1) * count);
    souls.push({
      s,
      off: WAKE + ((slot + Math.random() * 0.8) / count) * (FLOW_END - WAKE),
      dur: tr * (0.86 + Math.random() * 0.3),
      lane: ((i % LANES) / (LANES - 1) - 0.5) * 2 * lanes,
      braid: 2.4 + (i % 3) * 1.3,
      phase: i * 2.39996,
      wob: (Math.random() - 0.5) * 0.10,
      // Six or seven pixels across and twenty long at play distance — a card
      // is sixty across, so a soul is about a tenth of one. Measured off
      // frozen frames in both directions: at 0.17 by 0.46 the whole current
      // was a violet scratch, and at 0.27 by 0.94 with a wide bright core it
      // was smoke. This is the size at which a dozen of them on the table
      // still count as a dozen.
      w: 0.17 + Math.random() * 0.05,
      len: 0.54 + Math.random() * 0.26,
      // Uneven, and that unevenness is the point. A handful of leaders carry
      // the read and the rest are the body of the current — thirty souls all
      // at one strength is a single bright cord, which is the object this
      // motif was rejected for.
      //
      // THE RANGE IS NARROW AND THAT IS THE FIX FOR THE COUNT. Spread 0.46 to
      // 0.92, thirty souls in flight showed up as six: the one-in-seven
      // leaders carried the whole picture and the body of the current sat
      // under the threshold this dark arena puts on a small violet sprite, so
      // the current read as a few bright scratches on an empty board — which
      // is a line of beads, which is the tether. Every soul has to clear that
      // threshold or it is not in the shoal. The leaders are pulled DOWN to
      // meet the body rather than the body pushed up to meet them, because it
      // is the leaders that would go white where two of them cross.
      lit: i % 9 === 0 ? 0.95 : 0.62 + Math.random() * 0.20,
    });
    g.add(s);
  }

  const head = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const dir = new THREE.Vector3();

  kit.hold(g, SPAN, (t) => {
    /* ---- the bed and the channel: laid once the current is running ---- */
    // They run the WHOLE way for the whole time the current is flowing. The
    // old motif's line grew out from the card and then shortened, which is the
    // reel — a channel is simply open or shut.
    const onk = Math.min(1, Math.max(0, (t - WAKE + 0.02) / 0.16));
    const offk = Math.min(1, Math.max(0, (t - FLOW_END) / (1 - FLOW_END - 0.12)));
    const bright = easeOut(onk) * (1 - easeIn(offk));
    for (let i = 0; i < SEG; i++) {
      path(i / (SEG - 1), bedPts[i]);
      bedPts[i].y = BED_Y;
    }
    // Wide enough to sit under the braid and no wider. At lanes*2.4 + 0.5 it
    // was two and a half units across — a road, and painted red to prove it
    // was drawing it turned out to be covering a third of the board. A groove
    // is what this is. Taken in again when it was lifted off the stone: down
    // there it was hidden by the cards, up here it is on them, and a band as
    // wide as a card swallows the one it ends on.
    layFlat(bedGeo, bedPts, lanes * 1.05 + 0.18);
    // Dark enough to be worth having. At 0.60 of a near-black map — measured,
    // not guessed: painted flat red it turned out to be a band forty-odd
    // pixels across covering a third of the board — it still changed nothing
    // you could see, which is the worst of both, a large object doing no work.
    // Narrow enough to hug the braid instead and it can afford to be dark.
    bed.material.opacity = 0.85 * bright;

    /* ---- the pile ---- */
    const open = Math.max(0, Math.min(1, (t - WAKE + 0.04) / 0.14));
    const shut = Math.max(0, Math.min(1, (t - FLOW_END + 0.08) / 0.24));
    // 0.62 and not 0.9. Additive, over a CARD_W*1.2 plate, on top of a
    // face-up pile that is already bright art: at 0.9 the Graveyard was a
    // solid violet slab for a third of a second and the card being taken out
    // of it could not be seen at all — which is the one thing this is about.
    mouth.material.opacity = 0.62 * easeOut(open) * (1 - shut);
    mouth.scale.setScalar(0.5 + easeOut(open) * 0.6 + shut * 0.3);

    /* ---- the souls ---- */
    for (const m of souls) {
      const k = (t - m.off) / m.dur;
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
      // every soul by up to fifteen degrees and is just visible as a stream
      // whose wisps do not lie along it.
      if (CAM) {
        path(Math.min(1, u + 0.02), ahead, lane, m.wob);
        dir.copy(ahead).sub(pos).transformDirection(CAM.matrixWorldInverse);
        m.s.material.rotation = Math.atan2(-dir.x, dir.y);
      }
      // Shrinking as it goes under — the current is being drunk, not stopped.
      // It starts at 0.88 and not 0.78: a card is only about a tenth of a long
      // run across, so a fade beginning at 0.78 had every soul dead a card's
      // width SHORT of the card, and the current ended in a gap of bare stone
      // with the glow sitting on its own beyond it. The souls have to be seen
      // going under the edge.
      const gone = Math.max(0, (u - 0.88) / 0.12);
      m.s.scale.set(m.w * (1 - gone * 0.55), m.len * (1 - gone * 0.6), 1);
      m.s.material.opacity = m.lit * Math.min(1, k * 7) * (1 - easeIn(gone)) * bright;
    }

    /* ---- underneath the fighter ---- */
    // The ground under the card lights as the first souls reach it, holds
    // while the current runs, and dies after it stops. Tied to the flow rather
    // than to a moment of its own, so a long run from the far corner and a
    // short one from the near square both light the card when they ARRIVE.
    const fed = Math.min(1, Math.max(0, (t - (WAKE + tr)) / 0.18));
    const ebb = Math.max(0, Math.min(1, (t - FLOW_END - 0.06) / 0.26));
    const lit = easeOut(fed) * (1 - easeIn(ebb));
    // Flickering, faintly and fast. A steady glow is a lamp under the card; a
    // glow that stirs is something pouring into it.
    const stir = 1 + 0.09 * Math.sin(t * 47) + 0.05 * Math.sin(t * 29 + 1.7);
    under.material.opacity = 0.64 * lit * stir;
    under.scale.setScalar(0.88 + 0.16 * lit);
    hem.material.opacity = 0.85 * lit;

    /* ---- the prize, surfacing ---- */
    if (t > SURFACE - 0.02) {
      const rise = Math.min(1, Math.max(0, (t - SURFACE) / (HOME - SURFACE)));
      // It starts UNDER the card and is hidden by it — no alpha ramp, no fade
      // in. The card's own silhouette uncovers it as it climbs, so it slides
      // out from beneath the card's far edge the way a thing coming up
      // through a floor does. Faded in instead, in the air, it read as a decal
      // being switched on over the art, which is the mistake raise.js records
      // about its hand and is the same mistake here.
      head.set(p.x, UNDER + (0.98 - UNDER) * easeOut(rise), p.z);
      const goneHome = Math.max(0, (t - HOME) / (1 - HOME));
      // GOING TO HAND, in the table's own words. anim.draw already owns that
      // move — a card lifts, arcs out past the player's near corner, rolls,
      // and SHRINKS away to nothing — and a player has watched it on every
      // draw of every game. Two earlier exits were invented instead: one rose
      // straight up, which on this camera goes away from the hand and read as
      // the prize escaping, and one swelled toward the lens, which reads as a
      // thing arriving rather than a thing leaving. Copying the draw settles
      // it; the destination offsets below are anim.draw's, scaled back because
      // this one starts a metre in the air and not on the deck.
      const e = easeInOut(goneHome);
      prize.position.set(
        head.x + e * near * 1.5,
        head.y + Math.sin(Math.PI * goneHome) * 0.5,
        head.z + e * near * 3.4,
      );
      prize.rotation.x = -Math.PI / 2 + e * near * 0.9;
      prize.rotation.z = e * 0.4;
      prize.scale.setScalar((0.72 + 0.28 * rise) * (1 - e * 0.55));
      prize.material.opacity = 1 - easeIn(Math.max(0, (goneHome - 0.4) / 0.6));
    }
  });

  // Light at both ends and nowhere in between: the braziers are low, and a
  // seven-unit run lit along its whole length washes the board out.
  kit.after(WAKE * SPAN, () => {
    // 10, not 15. The plate above and this lamp are the same colour in the
    // same place, so at full the pile got lit twice.
    kit.light(B, 0x7c4ae0, { power: 10, seconds: 0.42, reach: 4.0 });
  });
  // ...and the one at the card sits BELOW its face on purpose. A point light
  // under a flat card cannot light the face at all — the face's normal points
  // away from it — so all it can reach is the slab's edges and the stone
  // around the square, which is exactly the light the ring above is painting.
  // Put a few hundredths ABOVE the card instead it blows the whole face white,
  // which is the failure raise.js records about its own lamps.
  kit.after((WAKE + travel(reach)) * SPAN, () => {
    kit.light(new THREE.Vector3(p.x, UNDER + 0.02, p.z), 0x8a58f0,
      { power: 5.0, seconds: 0.62, reach: 2.6 });
  });
}
