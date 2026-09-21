// RECALL — a plan called back out of your Graveyard.
//
// Shared by 1 card: the Battlemaster (C006), "Tactician" — he deploys, and
// immediately reaches back for a stratagem he has already spent once.
//
// One motif, one file — worked on on its own.
//
// This is the INQUISITION's version of an act the Gloaming also has
// (harvest.js): something is taken out of the dead pile and put into your
// hand. Everything about the two has to differ except the destination.
// Harvest throws a torn strap of grave-wrapping, BITES the pile and hauls the
// prize home on a long organic arc — a snatch. A Battlemaster does not snatch.
// He gives an order and an order is obeyed, so this is:
//
//    a seal struck on the stone round him   — the signal given
//    an iron rule run out to the pile       — the channel opened, dead level
//    the same seal stamped on the pile      — the order served
//    a document marched back along it       — the answer returned
//
// and the shape of the whole thing is a STRAIGHT HORIZONTAL LINE between two
// verticals: a standard planted on his card and a stamp dropped on the pile.
// Nothing here arcs, nothing whips, nothing eases into its travel — the rule
// runs out at a constant speed and the plan comes back at a constant speed,
// because that is the difference between an order and a lunge. (decree.js
// learned the same thing about the ground: easing a front out turns a law into
// a shockwave.)
//
// The prize is a DOCUMENT and not a glow: a near-black card-shaped plate with
// a lamplight rule round it, a title bar and three ruled lines. At sixty
// pixels the only silhouette this game has taught anyone to read is a card,
// and a written one is what a Tactic is. Additive light was tried for it first
// and came out of ACES tone mapping as a white slab — a lens flare lying on
// the table. The dark is what carries.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=400" \
//             --eval tools/fxdemo/recall.js --out /tmp/rc-400.png \
//             --wait 5000 --settle 600
// where ?t is the moment in the MOTIF to freeze at, in milliseconds. The
// harness also takes ?sq (the reach is 2.4 units from the near-right square
// and 7.7 from the far corner), ?grave (how tall the pile is — 0 must not
// throw) and ?side. All four change what this looks like.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { graveyardPosition } from '../../board.js';
import { burst, glow } from '../iron-kit.js';

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map.

/**
 * THE SEAL — his mark, struck at both ends of the motif.
 *
 * Corner brackets, an inner rule and four registration ticks: an official
 * frame that does not close, so it never doubles the card's own border. The
 * same stamp lands on his card when the order is given and on the Graveyard
 * when it is served, which is what says the two events are one act.
 *
 * It is SQUARE TO THE BOARD at both ends and takes no part in aiming. The
 * first version had a shaft and two chevrons painted into it and was yawed
 * along the run so the arrow pointed at the pile — which turned the frame into
 * a diamond sitting on a square pile, corners hanging off every edge. The
 * direction lives in the arrow that travels (headTexture) instead; a stamp is
 * pressed straight, and only the thing that moves has a heading.
 *
 * Thin line-art, nearly card-wide. brand.js paid for that lesson: at forty-odd
 * pixels a heavy annulus fills in and becomes a blob, and what survives is a
 * WIDE, THIN figure. Drawn twice — once blurred, once crisp — because this
 * renderer has no bloom pass and hot metal without falloff looks like a decal.
 */
let SEAL = null;
function sealTexture() {
  if (SEAL) return SEAL;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');

  const paint = (lw) => {
    g.lineCap = 'square';
    g.lineJoin = 'miter';
    // four heavy corner brackets
    const i = 14, arm = 66;
    g.lineWidth = lw;
    for (const [x, y, sx, sy] of [[i, i, 1, 1], [256 - i, i, -1, 1],
      [256 - i, 256 - i, -1, -1], [i, 256 - i, 1, -1]]) {
      g.beginPath();
      g.moveTo(x + sx * arm, y);
      g.lineTo(x, y);
      g.lineTo(x, y + sy * arm);
      g.stroke();
    }
    // and the boss in the middle of them
    g.lineWidth = lw * 0.8;
    g.beginPath();
    g.moveTo(128, 90); g.lineTo(166, 128); g.lineTo(128, 166); g.lineTo(90, 128);
    g.closePath();
    g.stroke();
  };

  // One soft pass for the falloff and one hard pass on top. Two blurred passes
  // were tried and the mark came out of the close-up as a smear of light with
  // no edges anywhere — this faction is hard edges, and a seal that has gone
  // soft is a candle, not a stamp.
  g.strokeStyle = '#fff';
  g.shadowColor = 'rgba(255,200,120,0.95)';
  g.shadowBlur = 7;
  g.globalAlpha = 0.28;
  paint(13);
  g.shadowBlur = 0;
  g.globalAlpha = 1;
  paint(13);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  SEAL = t;
  return t;
}

/**
 * The shadow the seal is struck into.
 *
 * Thin gold line-art laid straight onto lit card art is a smear — the art
 * underneath is already bright and varied, and additive light on top of it
 * adds no edges. So the card is DARKENED first and the mark is cut into that.
 * Contrast is bought with shadow, not with power; it is also what lamplight
 * falling on a card actually looks like.
 */
let SHADE = null;
function shadeTexture() {
  if (SHADE) return SHADE;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grd.addColorStop(0.00, 'rgba(6,5,4,0.95)');
  grd.addColorStop(0.62, 'rgba(6,5,4,0.85)');
  grd.addColorStop(1.00, 'rgba(6,5,4,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  SHADE = t;
  return t;
}

/**
 * THE RAIL — a measured iron rule, seen from above.
 *
 * `u` runs along its length and is REPEATED, so the graduations stay the same
 * physical size whether the reach is two units or eight; `v` is across it.
 * Dark down the middle with a lamplight hairline along each edge, because a
 * lit bar laid over lit stone is a smear — the contrast has to be bought with
 * the dark core, not with more light on the edges.
 */
let RAIL = null;
function railTexture() {
  if (RAIL) return RAIL;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(13,10,8,0.92)';
  g.fillRect(0, 4, 128, 24);
  // The two lit edges, five texels each. At four they were a pixel and a half
  // on the game's own camera and the rule read as a pencil line drawn across
  // the board — the light on it simply was not there until it was zoomed in on.
  // 0.74 and not 0.95. THE ARENA IS DARKER THAN IT WAS when this was set:
  // the key is now a spotlight on the board and the apron round it is nearly
  // black, and two five-texel edges at 0.95 over a 0.92 black core is not an
  // iron rule any more, it is a BARBER POLE — the hardest, brightest thing in
  // the frame, drawn diagonally across other people's cards. The dark core
  // still buys the contrast; the edges only have to say which way is up.
  const edge = 'rgba(255,203,128,0.74)';
  g.fillStyle = edge;
  g.fillRect(0, 3, 128, 5);
  g.fillRect(0, 24, 128, 5);
  // Graduations, hanging INWARD from each edge with a dark gap down the
  // middle. Full-width rungs were the first try and the rule read as a LADDER
  // laid across the table — the one thing an order must not look like is
  // scaffolding. Kept off the seam so RepeatWrapping does not smear the tick
  // across the join.
  g.fillStyle = 'rgba(255,220,158,0.60)';
  g.fillRect(60, 8, 5, 5);
  g.fillRect(60, 19, 5, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  RAIL = t;
  return t;
}

/**
 * THE PLAN — a written order, near-black with a lamplight rule.
 *
 * Square corners and straight rules: this faction has no curves. The title bar
 * is the single feature that does the work at forty pixels — without it the
 * plate was a dark rectangle with a bright edge, which is a card back, and a
 * Tactic returning to hand should read as something WRITTEN.
 */
let PLAN = null;
function planTexture() {
  if (PLAN) return PLAN;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const body = g.createLinearGradient(0, 18, 0, 238);
  body.addColorStop(0.00, 'rgba(22,17,12,0.93)');
  body.addColorStop(0.60, 'rgba(10,8,6,0.88)');
  body.addColorStop(1.00, 'rgba(17,13,9,0.8)');
  g.fillStyle = body;
  g.fillRect(18, 18, 220, 220);
  // the rule, twice: a wide soft one that carries across the table and a
  // tight bright one that keeps the corners square up close
  g.strokeStyle = 'rgba(176,132,62,0.5)';
  g.lineWidth = 16;
  g.strokeRect(18, 18, 220, 220);
  g.strokeStyle = 'rgba(255,220,156,0.95)';
  g.lineWidth = 5;
  g.strokeRect(18, 18, 220, 220);
  // the writing
  g.fillStyle = 'rgba(240,206,150,0.62)';
  g.fillRect(44, 48, 168, 26);
  g.fillStyle = 'rgba(206,172,112,0.34)';
  g.fillRect(44, 110, 168, 10);
  g.fillRect(44, 142, 168, 10);
  g.fillRect(44, 174, 104, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  PLAN = t;
  return t;
}

/**
 * The head of the run: a chevron with a wake behind it, pointing +x.
 *
 * Sprites cannot be turned to face the way they are going, but a plane can —
 * this one is laid flat and yawed along the rail, so the same picture serves
 * the order going out and the answer coming back by being turned round.
 */
let HEAD = null;
function headTexture() {
  if (HEAD) return HEAD;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const wake = g.createLinearGradient(0, 0, 128, 0);
  wake.addColorStop(0.00, 'rgba(255,196,110,0)');
  wake.addColorStop(0.70, 'rgba(255,220,154,0.42)');
  wake.addColorStop(1.00, 'rgba(255,236,196,0.72)');
  g.fillStyle = wake;
  g.fillRect(0, 22, 128, 20);
  g.strokeStyle = 'rgba(255,242,214,0.98)';
  g.shadowColor = 'rgba(255,206,130,0.9)';
  g.shadowBlur = 12;
  g.lineWidth = 9;
  g.lineCap = 'square';
  g.beginPath();
  g.moveTo(80, 12); g.lineTo(116, 32); g.lineTo(80, 52);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  HEAD = t;
  return t;
}

/** A soft round pool, for the lamplight under the seal at either end. */
let POOL = null;
function poolTexture() {
  if (POOL) return POOL;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0.00, 'rgba(255,230,180,0.85)');
  grd.addColorStop(0.30, 'rgba(240,190,110,0.42)');
  grd.addColorStop(0.68, 'rgba(180,120,50,0.14)');
  grd.addColorStop(1.00, 'rgba(120,70,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  POOL = t;
  return t;
}

/* ------------------------------------------------------------- geometry */

/**
 * The top of the discard pile, measured rather than guessed.
 *
 * The pile is a box scaled by how many cards are in it, so its top is anywhere
 * between 6cm and half a unit — a fixed height stamps the seal inside a big
 * pile or a hand's breadth above an empty one. The pile carries `graveOf` for
 * picking, and so does an invisible 40cm pick pad, which is why anything not
 * drawn is skipped. Never throws: an empty Graveyard just answers low.
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

// Where a flat thing has to sit to be drawn ON a card rather than only on the
// stone around it. kit.at answers about 0.2 for a card whose face is at 0.21,
// and under about +0.05 the depth test fails on equal — the card itself is
// then the one place nothing appears.
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

/** A flat plane lying face-up, yawed so its own +x runs along `d`. */
function lieFlat(mesh, d) {
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = Math.atan2(-d.z, d.x);
  mesh.rotation.x = -Math.PI / 2;
}

/* ----------------------------------------------------------------- time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. One card, so it can afford
// to be a sentence — but the UI is held while it runs and that is the ceiling.
const SPAN = 1.42;
const SIGNAL = 0.09;   // the seal is struck on the stone and the standard is up
const OUT = 0.30;      // the rule has run the whole way to the pile
const STAMP = 0.39;    // the stamp has come down on it
const RISE = 0.50;     // the plan is clear of the pile and on the rule
const HOME = 0.80;     // it has marched back to him
// 0.80 and not 0.55. Across the longest reach on the board 0.55 put thirteen
// pairs of ticks on the rule, which at this size is not a measured rule, it is
// a stripe pattern — and a striped bar laid diagonally over the flagstones
// reads as a barrier rather than as an order being carried. Eight is a rule.
const PERIOD = 0.80;   // world units between graduations on the rule

// The return is the longest beat on purpose — nearly half a second of it, and
// half again as long as the run out. The first cut gave the march home a third
// of a second over seven units, which is twenty units a second: the answer
// arrived before the eye had found it, and the beat that the whole motif
// exists for was the one nobody saw. An order goes out briskly and comes back
// at the pace of someone carrying something.

// CONSTANT SPEED, with only the first tenth softened so things start rather
// than jump. Everything that travels in this motif uses it. easeInOut was
// tried and it is an order delivered by someone sauntering: two thirds of the
// journey happens in the middle third of the time, and the frames either side
// of that have the rail sitting still at one end or the other.
const march = (k) => (k < 0.12 ? (k * k) / 0.24 : k - 0.06) / 0.94;
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);

export function recall(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const owner = kit.piece(at)?.owner ?? 0;
  const near = owner === 0 ? 1 : -1;          // which way the player's hand is
  const gp = graveyardPosition(owner);
  const top = graveTop(kit, owner);

  // The two ends, and the level the rule is run at. It clears both the card
  // face and the pile — a rule that dives into a six-card Graveyard is a
  // girder dropped on it, and the whole point of the shape is that it is
  // LEVEL.
  const A = new THREE.Vector3(p.x, flatY(p), p.z);
  const RAIL_Y = Math.max(A.y + 0.42, top + 0.36);
  const d = new THREE.Vector3(gp.x - A.x, 0, gp.z - A.z);
  const L = Math.max(0.5, d.length());
  d.normalize();
  const along = (u, y, out) => out.set(A.x + d.x * u, y, A.z + d.z * u);

  const g = new THREE.Group();
  const tmp = new THREE.Vector3();

  /* ---- his standard: the vertical the rule is run from */
  // Without it the rail floated off the side of his card with nothing holding
  // it up, which read as a beam passing overhead rather than a line HE put
  // out. It is deliberately spindly — this is a signal staff, not a mast.
  // Lit iron, not iron. The braziers are low and there is no environment map,
  // so a physically metallic post renders as a black slab standing on the art
  // — which is what the close-up caught it being. The emissive is what makes
  // it read as a staff with a lamp on it rather than a hole.
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xbfae94, metalness: 0.7, roughness: 0.3,
      emissive: 0xffbb62, emissiveIntensity: 1.6, transparent: true,
    }),
  );
  post.castShadow = true;
  g.add(post);

  // The lamp at the head of it. A bare post seen from a camera nineteen units
  // up is four pixels of dark iron lying on the art — it disappeared, and the
  // rule looked like it began in mid-air over his card. This is the bright
  // point the line is run from, and it is the only thing at the card end that
  // survives the game's own zoom.
  const lamp = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({
      map: poolTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  lamp.rotation.x = -Math.PI / 2;
  lamp.renderOrder = 3;
  g.add(lamp);

  /* ---- the rule */
  // The repeat is animated, so the texture cannot be the shared one: it is
  // cloned per cast and disposed when the motif ends. kit.hold disposes
  // materials but never their maps, so this is the only thing that can leak.
  const railTex = railTexture().clone();
  railTex.needsUpdate = true;
  const rail = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: railTex, transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  lieFlat(rail, d);
  rail.renderOrder = 2;
  g.add(rail);

  /* ---- the head of the run, and the one that brings the answer back */
  const mkHead = (dir) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.34),
      new THREE.MeshBasicMaterial({
        map: headTexture(), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    lieFlat(m, dir);
    m.renderOrder = 3;
    g.add(m);
    return m;
  };
  const outHead = mkHead(d);
  const backHead = mkHead(d.clone().negate());

  /* ---- the shadow each seal is struck into */
  const mkShade = (size) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map: shadeTexture(), transparent: true, opacity: 0, depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    g.add(m);
    return m;
  };
  const shadeA = mkShade(CARD_W * 2.1);
  const shadeB = mkShade(CARD_W * 1.1);

  /* ---- the seal, at both ends */
  const mkSeal = (size) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map: sealTexture(), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    // Tinted lamplight rather than left white. The brackets are painted white
    // so the blurred pass reads as hot metal, and untinted over ACES they blew
    // into a white grille sitting on the art.
    m.material.color.setHex(0xffa845);
    m.rotation.x = -Math.PI / 2;      // square to the board, at both ends
    m.renderOrder = 3;
    g.add(m);
    return m;
  };
  // The two are struck at different sizes on purpose. His goes on the STONE,
  // ROUND the card: at sixty pixels a frame drawn ON the card is a frame round
  // a frame, and every attempt at it came out as a pale slab where the art had
  // been — the card simply looked blank. Outside the card there is dark stone
  // to cut it into, which is the only place on this table a thin gold line has
  // any contrast. The pile's goes ON the pile, because a mark bigger than the
  // pile would be hanging in the air off the side of it.
  const mark = mkSeal(CARD_W * 1.62);    // on the stone round his card
  const stamp = mkSeal(CARD_W * 0.82);   // on the pile

  /* ---- the lamplight under each seal */
  const mkPool = () => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.5, CARD_H * 1.5),
      new THREE.MeshBasicMaterial({
        map: poolTexture(), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    m.material.color.setHex(0xffb968);
    m.rotation.x = -Math.PI / 2;
    // between the shadow and the seal: the pool is the light IN the shadow,
    // and drawn the other way round the shadow simply erased it
    m.renderOrder = 2;
    g.add(m);
    return m;
  };
  const poolA = mkPool();
  const poolB = mkPool();
  // The flagstone face is at y=0.080. These three sit just clear of it in the
  // order they have to be drawn in — shadow, then the light in it, then the
  // line — and the card itself, whose face is at 0.21, hides their middles.
  poolA.position.set(A.x, 0.091, A.z);
  poolB.position.set(gp.x, top + 0.014, gp.z);
  shadeA.position.set(A.x, 0.088, A.z);
  mark.position.set(A.x, 0.094, A.z);
  shadeB.position.set(gp.x, top + 0.012, gp.z);
  poolA.scale.setScalar(1.35);

  /* ---- the plan itself */
  // Smaller than a real card on purpose. At full size it arrives exactly over
  // the card that called it, edge for edge, and stops being an object at all —
  // the motif then reads as "that card lit up" instead of "something came
  // back". Two thirds of a card, carried on the rule, is unmistakably a
  // separate thing being brought in.
  const PLAN_S = 0.66;
  const plan = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * PLAN_S, CARD_H * PLAN_S),
    new THREE.MeshBasicMaterial({
      map: planTexture(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  // Board-aligned and level the whole way: it does not tumble, it does not
  // spin. A carried order stays readable until the moment it is filed, and the
  // only roll it ever takes is the one anim.draw gives every card going to
  // hand, at the very end.
  plan.rotation.order = 'YXZ';
  plan.rotation.y = owner === 0 ? 0 : Math.PI;
  plan.rotation.x = -Math.PI / 2;
  plan.renderOrder = 4;
  g.add(plan);

  kit.hold(g, SPAN, (t) => {
    /* the standard goes up first */
    const up = easeOut(clamp01(t / (SIGNAL * 0.9)));
    const postH = (RAIL_Y - A.y) * up;
    post.scale.y = Math.max(0.001, postH);
    post.position.set(A.x, A.y + postH / 2, A.z);
    post.material.opacity = t < HOME ? 1 : clamp01((1 - t) / (1 - HOME));
    lamp.position.set(A.x, RAIL_Y + 0.02, A.z);
    lamp.material.opacity = 0.55 * up * (t < HOME ? 1 : clamp01((1 - t) / (1 - HOME)));

    /* how far the rule is run out, in world units from his card */
    let end;
    if (t < OUT) end = L * march(clamp01((t - SIGNAL * 0.5) / (OUT - SIGNAL * 0.5)));
    else if (t < RISE) end = L;
    else end = L * (1 - march(clamp01((t - RISE) / (HOME - RISE)))) + 0.34;
    end = Math.min(L, Math.max(0.001, end));

    // The rule always runs from HIS card to wherever the front is, so the
    // same number pays it out, holds it, and takes it back in behind the plan.
    rail.scale.set(end, 0.34, 1);
    along(end / 2, RAIL_Y, tmp);
    rail.position.copy(tmp);
    railTex.repeat.x = end / PERIOD;
    rail.material.opacity = Math.min(1, t / 0.04)
      * (t < HOME ? 1 : clamp01((1 - t) / (1 - HOME)));

    /* the order going out */
    const outLive = t > SIGNAL * 0.5 && t < OUT + 0.04;
    outHead.material.opacity = outLive
      ? 0.95 * Math.min(1, (t - SIGNAL * 0.5) / 0.04) * clamp01((OUT + 0.04 - t) / 0.06)
      : 0;
    if (outLive) {
      // clamped off his own card: unclamped it starts BEHIND the standard,
      // pointing at the pile from the wrong side of the thing it left
      along(Math.max(0.28, end - 0.22), RAIL_Y + 0.02, tmp);
      outHead.position.copy(tmp);
    }

    /* his mark: struck, then STANDING for as long as the channel is open */
    // It used to flash once and go. That left the middle of the motif with
    // nothing at the end that started it — the rule read as something passing
    // overhead rather than something he was holding one end of. The mark now
    // stays, faintly, for as long as the rule is out, and flares again when
    // the answer arrives on it.
    const sent = Math.max(0, 1 - t / (SIGNAL * 2.2)) ** 0.7 * Math.min(1, t / 0.015);
    const got = Math.max(0, 1 - Math.abs(t - HOME) / 0.1);
    const held = Math.min(1, t / 0.05) * (t < HOME ? 1 : clamp01((1 - t) / (1 - HOME)));
    const lit = Math.max(0.26 * held, Math.max(sent, got * 0.85));
    mark.material.opacity = 0.9 * lit;
    // it SNAPS shut rather than growing: a seal is pressed, not drawn
    mark.scale.setScalar(1 + (1 - easeOut(clamp01(t / SIGNAL))) * 0.55 + got * 0.12);
    poolA.material.opacity = 0.42 * Math.max(0.18 * held, Math.max(sent, got * 0.7));
    shadeA.material.opacity = 0.66 * lit;
    shadeA.scale.setScalar(0.9 + (1 - easeOut(clamp01(t / SIGNAL))) * 0.22);

    /* the stamp coming down on the pile */
    // easeIn, so it accelerates into the pile. It is a tool being brought
    // down by a hand — the one thing it must not do is settle gently.
    const fall = clamp01((t - OUT) / (STAMP - OUT));
    // It is spent QUICKLY once it lands. At a fifth of a second the stamp was
    // still on the pile when the plan rose through it, and all that was left
    // showing round the edges of the plan were two stray corner brackets — an
    // official mark reduced to litter.
    const struck = clamp01((t - STAMP) / 0.09);
    if (t > OUT - 0.02) {
      stamp.position.set(gp.x, top + 0.016 + (RAIL_Y - top) * (1 - easeIn(fall)), gp.z);
      // it opens as it dies, so the strike has a shockwave and the plan comes
      // up through the middle of his own mark rather than out from behind it
      stamp.scale.setScalar(1 + (1 - fall) * 0.42 + easeOut(struck) * 0.26);
      stamp.material.opacity = 0.92 * Math.min(1, (t - OUT + 0.02) / 0.04)
        * (1 - easeIn(struck));
      shadeB.material.opacity = 0.6 * fall * (1 - struck);
      shadeB.scale.setScalar(0.8 + fall * 0.2);
      // Half what it was. The pool and the point light together blew the whole
      // Graveyard into one white lump with no pile, no card and no seal in it.
      poolB.material.opacity = 0.34 * fall * (1 - struck * 0.7);
      poolB.scale.setScalar(0.6 + fall * 0.35 + struck * 0.25);
    }

    /* the plan: straight up out of the pile, then level all the way home */
    // Not a frame before the stamp lands. It used to start sixty milliseconds
    // early and the document was already two thirds of the way out of the pile
    // when the seal hit it, which put the answer before the order.
    if (t > STAMP) {
      const lift = easeOut(clamp01((t - STAMP) / (RISE - STAMP)));
      const back = clamp01((t - RISE) / (HOME - RISE));
      const u = L * (1 - march(back));
      // It rides ON the rule, not above it. At a third of a unit of clearance
      // the plan floated free of the line it was supposedly being brought in
      // on, and the two read as separate events happening at the same time.
      const y = (top + 0.1) + (RAIL_Y + 0.11 - top - 0.1) * lift;
      along(u, y, tmp);
      const gone = clamp01((t - HOME) / (1 - HOME));
      // GOING TO HAND, in the table's own words. anim.draw already owns that
      // move — a card lifts, arcs out past the player's near corner, rolls and
      // shrinks away — and a player has watched it on every draw of every
      // game. An invented exit was tried (the plan rising and fading on the
      // spot) and read as the order being cancelled rather than filed.
      const e = easeInOut(gone);
      plan.position.set(
        tmp.x + e * near * 1.5,
        tmp.y + Math.sin(Math.PI * gone) * 0.5,
        tmp.z + e * near * 3.4,
      );
      plan.rotation.x = -Math.PI / 2 + e * near * 0.9;
      plan.rotation.z = e * 0.4;
      plan.scale.setScalar((1 - e * 0.55));
      plan.material.opacity = Math.min(1, (t - STAMP) / 0.05)
        * (1 - easeIn(clamp01((gone - 0.35) / 0.65)));

      // the chevron that leads it home, while there is rail left to lead on
      const lead = back > 0.02 && back < 0.99;
      backHead.material.opacity = lead ? 0.9 * Math.min(1, back * 12) : 0;
      if (lead) {
        along(Math.max(0.1, u - 0.72), RAIL_Y + 0.02, tmp);
        backHead.position.copy(tmp);
      }
    }
  }, () => railTex.dispose());

  /* ---- light and iron, at the two ends only */
  // The braziers are low and the reach is up to eight units: lighting the
  // whole run washes the board out, so there is light where the seal is struck
  // and light where it is served, and nothing in between.
  glow(kit, A.clone().setY(A.y + 0.2), 0xffb265,
    { power: 9, life: 0.3, delay: 0, total: SPAN, reach: 3.0 });
  glow(kit, new THREE.Vector3(gp.x, top + 0.2, gp.z), 0xffc27a,
    // 10, not 14. The stamp already paints its own additive seal and pool on
    // the pile; lighting the same spot as hard again blew the Graveyard out
    // to a white slab at the exact moment the card is supposed to be read.
    { power: 10, life: 0.36, delay: STAMP * SPAN, total: SPAN, reach: 3.8 });
  glow(kit, A.clone().setY(A.y + 0.5), 0xffc98a,
    { power: 11, life: 0.32, delay: HOME * SPAN, total: SPAN, reach: 3.2 });
  // Iron struck on iron: a hard, low, fast scatter, not a puff. It is the only
  // disorderly thing in the motif and it lasts a fifth of a second.
  burst(kit, new THREE.Vector3(gp.x, top + 0.06, gp.z), {
    // Thrown WIDE and kept LOW. Packed over the middle of the pile they were
    // three fat blobs behind the document that was rising through them; out at
    // the edge of the slab, half of each one is against dark stone.
    colour: 'rgba(255,224,160,1)', count: 20, spread: 1.6, rise: 0.42, size: 0.3,
    life: 0.34, delay: STAMP * SPAN - 0.02, total: SPAN, gravity: 2.1,
  });
}
