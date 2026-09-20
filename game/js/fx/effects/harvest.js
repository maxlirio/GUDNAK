// HARVEST — something is drawn up out of the graveyard and into your hand.
//
// Shared by 3 cards: The Lich (R067), Empty Crypt (R074), Undead Horde (C086).
// One motif, one file — worked on on its own.
//
// All three RETRIEVE: the card reaches into the dead pile and takes something
// back out of it. So the motif is a gesture with two ends and a journey in
// between, and it is the only one on this table that leaves the nine squares
// at all — it runs off the board to the discard pile beside your deck, hooks
// something, and hauls it back.
//
// What it must not be:
//   - the Gloaming flourish (cast-gloaming.js) is motes SINKING into a card.
//     Everything here rises, and it happens over the pile, not over the card.
//   - raise.js is a body CLIMBING OUT onto a square. Nothing here lands. The
//     prize hangs over the card for a beat and then leaves the table on the
//     player's side, because it is going to hand and not to the board.
//
// The whole thing is a line: a tendril of grave-wrapping is thrown from the
// card to the pile, it takes hold, and then it REELS — the line shortens and
// the prize rides the tip of it back. That is the one reading that survives
// the real size of this game. A card is about sixty pixels across here, and
// nothing that happens INSIDE sixty pixels can say "from over there"; a lit
// line two and a half squares long says it at a glance, from any angle the
// table can be turned to.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=400" \
//             --eval tools/fxdemo/harvest.js --out /tmp/h-400.png --settle 700
// where ?t is the moment in the MOTIF to freeze at, in milliseconds, and the
// harness also takes ?sq (which square casts it — the reach is two units from
// the near-right square and seven from the far corner), ?grave (how tall the
// pile is) and ?side (the far player, whose hand is the other way). All four
// change what this looks like and all four were got wrong at some point.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { graveyardPosition } from '../../board.js';

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map.

/**
 * The tendril: a strip of grave-wrapping, bright where it grips and dark where
 * it trails back to the card.
 *
 * The strip's uv runs `u` along its length and `v` across, so this canvas is
 * laid out the same way — x is distance from the card, y is across the ribbon.
 * The edges are eaten away rather than feathered evenly, because a ribbon with
 * two clean parallel edges is a drawn line, and what this wants to be is
 * something torn off a shroud.
 */
let WRAP = null;
function wrapTexture() {
  if (WRAP) return WRAP;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  // Along the length: near-black at the card end going to a cold violet at the
  // gripping end, so the ribbon has a direction in it even in a still frame.
  //
  // The gripping end is a LIGHT violet and not a PALE one. It was painted at
  // (186,146,255) first, and between the emissive term and the point light at
  // the pile that came out of ACES tone mapping as a white streak lying across
  // the Graveyard — the end of the motif that has to look coldest was the one
  // that looked like a spark. Holding the red down while the blue stays up is
  // what reads as cold here; making it darker is not the same thing.
  const run = g.createLinearGradient(0, 0, 256, 0);
  run.addColorStop(0.00, 'rgba(26,8,52,1)');
  run.addColorStop(0.35, 'rgba(66,26,132,1)');
  run.addColorStop(0.74, 'rgba(112,60,212,1)');
  run.addColorStop(1.00, 'rgba(142,96,238,1)');
  g.fillStyle = run;
  g.fillRect(0, 0, 256, 64);
  // Across: solid down the middle, gone at the edges.
  const across = g.createLinearGradient(0, 0, 0, 64);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.28, 'rgba(0,0,0,0.85)');
  across.addColorStop(0.50, 'rgba(0,0,0,1)');
  across.addColorStop(0.72, 'rgba(0,0,0,0.85)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, 256, 64);
  // and then bitten into, so the silhouette frays as it runs
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256;
    const r = 4 + Math.random() * 11;
    g.beginPath();
    g.arc(x, Math.random() < 0.5 ? 6 : 58, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  WRAP = t;
  return t;
}

/**
 * The prize: a card-shaped hole in the light, with a cold rim.
 *
 * A CARD is the one silhouette this game has taught the player to read, so the
 * thing being retrieved is card-shaped and nothing else — at sixty pixels a
 * rectangle with a lit edge is unmistakable, where a blob of light is just
 * another spark.
 */
let PRIZE = null;
function prizeTexture() {
  if (PRIZE) return PRIZE;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  PRIZE = t;
  return t;
}

/**
 * Grave-dust, as a comet with its head at the TOP.
 *
 * Sprites cannot be turned to face the way they are going, so direction has to
 * be baked into the picture or a still frame says nothing. cast-gloaming's
 * dust is the same trick pointing the other way, and that is the point: the
 * flourish falls, the harvest rises.
 */
let DUST = null;
function dustTexture() {
  if (DUST) return DUST;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const up = g.createLinearGradient(0, 0, 0, 128);
  up.addColorStop(0.00, 'rgba(198,166,255,0)');
  up.addColorStop(0.12, 'rgba(198,166,255,0.95)');
  up.addColorStop(0.32, 'rgba(146,98,248,0.72)');
  up.addColorStop(0.66, 'rgba(96,52,206,0.30)');
  up.addColorStop(1.00, 'rgba(60,26,150,0)');
  g.fillStyle = up;
  g.fillRect(0, 0, 64, 128);
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.50, 'rgba(0,0,0,1)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  DUST = t;
  return t;
}

/** A soft round glow, for the mouth that opens in the pile. */
let HALO = null;
function haloTexture() {
  if (HALO) return HALO;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0.00, 'rgba(206,176,255,0.95)');
  grd.addColorStop(0.24, 'rgba(140,92,246,0.62)');
  grd.addColorStop(0.58, 'rgba(78,34,178,0.26)');
  grd.addColorStop(1.00, 'rgba(50,20,120,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  HALO = t;
  return t;
}

/* ------------------------------------------------------------- geometry */

/**
 * The top of the discard pile, measured rather than guessed.
 *
 * The pile is a box scaled by how many cards are in it, so its top is anywhere
 * between 6cm and half a unit. A fixed height was wrong in both directions —
 * over an empty Graveyard the tendril gripped thin air, and over a big one it
 * disappeared INSIDE the stack. The pile carries `graveOf` for picking, so it
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

// Where a flat thing has to sit to be drawn ON a card rather than only on the
// stone around it. kit.at answers about 0.2 for a card whose face is at 0.21,
// and at anything under about +0.05 the depth test fails on equal and the card
// itself is the one place nothing appears.
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

/* ----------------------------------------------------------------- time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. This is a rare motif — three
// cards — so it can afford to be a sentence rather than a word, but the UI is
// held while it runs and that is the ceiling.
const SPAN = 1.3;
const THROW = 0.19;       // the tendril is out and gripping the pile
const BITE = 0.32;        // the pile has given it up
const HOME = 0.78;        // the line is in and the prize hangs over the card
const SEG = 48;           // ribbon segments
const LIFT = 0.8;         // how high the reel has raised the prize by then
const SURFACE = 0.3;      // and how far it breaks clear of the pile before that

// The reel, as its own curve. easeInOut was tried and it is the wrong shape
// for a line coming in: its cubic ends spend a third of the journey barely
// moving at the pile and another third barely moving at the card, so the
// screenshots at 0.43 and 0.60 of the motif had the prize sitting still at
// either end and the whole crossing happened between two frames nobody sees.
// Smoothstep has the same softened ends and a far flatter middle: the prize
// is actually in transit for most of the time it is in transit.
const reel = (k) => k * k * (3 - 2 * k);

export function harvest(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const owner = kit.piece(at)?.owner ?? 0;
  const near = owner === 0 ? 1 : -1;          // which way the player's hand is
  const gp = graveyardPosition(owner);

  // The two ends. The card end sits a little clear of the card face so the
  // ribbon's root is not buried in the art; the pile end is measured.
  const A = new THREE.Vector3(p.x, flatY(p) + 0.05, p.z);
  const B = new THREE.Vector3(gp.x, graveTop(kit, owner) + 0.16, gp.z);

  // A bow sideways as well as upward, so the line is a thrown thing and not a
  // ruler laid between two points. Straight, it read as a laser sight.
  const flat = new THREE.Vector3(B.x - A.x, 0, B.z - A.z);
  const span = Math.max(0.6, flat.length());
  const bow = new THREE.Vector3(-flat.z, 0, flat.x).normalize()
    .multiplyScalar(Math.min(0.75, span * 0.11) * near);
  // and an arch whose peak is nearer the CARD end, so the prize is still
  // climbing for most of the way home — "drawn UP out of the graveyard"
  const arc = Math.min(1.05, 0.28 + span * 0.1);

  const path = (u, out) => {
    const s = Math.sin(Math.PI * u);
    out.set(
      A.x + (B.x - A.x) * u + bow.x * s,
      A.y + (B.y - A.y) * u + arc * Math.sin(Math.PI * u ** 0.65),
      A.z + (B.z - A.z) * u + bow.z * s,
    );
    return out;
  };

  const g = new THREE.Group();

  /* ---- the tendril */
  // The wrap goes on BOTH map and emissiveMap. With it on `map` alone the
  // ribbon was one flat neon bar end to end: three.js modulates emissive by
  // emissiveMap and by nothing else, so the painted gradient — near-black at
  // the card, cold violet where it grips — was being drowned by a constant
  // glow. On both, the dark end is dark in both terms.
  //
  // The width scales with how far it has to go. A fixed 0.34 was right across
  // the board and a fat strap over the two and a bit units between the
  // near-right square and the pile — a ribbon reads by its proportions.
  const strip = kit.strip({
    segments: SEG, width: Math.min(0.36, 0.2 + span * 0.023),
    colour: 0xffffff, emissive: 1.15,
  });
  strip.mat.map = wrapTexture();
  strip.mat.emissiveMap = wrapTexture();
  strip.mat.emissive.setHex(0xffffff);
  strip.mat.color.setHex(0x9e86d8);
  // kit.strip casts shadows by default, for cloth. A lit ribbon dropping a
  // hard black shadow across the card it starts on read as a strap of tar.
  strip.mesh.castShadow = false;
  strip.mesh.renderOrder = 2;
  g.add(strip.mesh);
  const pts = Array.from({ length: SEG }, () => new THREE.Vector3());

  /* ---- the cold light welling out of the pile */
  const mouth = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.2, CARD_H * 1.2),
    new THREE.MeshBasicMaterial({
      map: haloTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.set(B.x, B.y - 0.1, B.z);
  g.add(mouth);

  /* ---- the card's own mark, which fires twice */
  // The motif's two ends are seven units apart and the eye has to be told
  // where it STARTED or the line looks like something arriving from off-table
  // rather than something this card threw. A flat violet flare on the card at
  // the throw says "this one", and the same flare again at the catch punctuates
  // the moment the line comes in — without it the ribbon simply stopped being
  // there and the arrival had no beat at all.
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.45, CARD_H * 1.45),
    new THREE.MeshBasicMaterial({
      map: haloTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  // Tinted violet rather than left white. The halo's own middle is nearly
  // white so that it can serve as a hot core over the pile, and untinted on
  // the card it blew straight through ACES into a white sun sitting on the
  // art — a lens flare, in a faction whose whole look is the absence of light.
  mark.material.color.setHex(0x7d4ae2);
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(A.x, flatY(p), A.z);
  g.add(mark);

  /* ---- the prize */
  // Smaller than a real card on purpose. At full size it landed exactly over
  // the card it was drawn to, edge for edge, and stopped being an object at
  // all — the whole motif read as "that card lit up" instead of "something
  // came back". Seven tenths, hanging a metre up, is unmistakably a separate
  // thing in the air above it.
  const prize = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 0.7, CARD_H * 0.7),
    new THREE.MeshBasicMaterial({
      map: prizeTexture(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  prize.rotation.order = 'YXZ';
  prize.rotation.y = owner === 0 ? 0 : Math.PI;
  prize.rotation.x = -Math.PI / 2;
  prize.renderOrder = 3;
  g.add(prize);

  /* ---- grave-dust: off the pile when it opens, shed by the prize after */
  const motes = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dustTexture(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const a = i * 2.39996;
    // A RING, not a disc. Packed over the middle of the pile the dust was
    // additive violet laid on top of a face-up card's own art, which adds
    // almost no contrast and simply vanished; straddling the edge of the pile
    // puts half of every puff against dark stone, where it shows.
    const r = 0.58 + Math.sqrt((i + 0.6) / N) * 0.52;
    // The first ten come out of the pile; the rest are shed along the way
    // home, so the prize trails grave-dust instead of flying clean. Seeded on
    // a stride rather than at random: a rare motif gets looked at, and one bad
    // deal where four motes stack in a corner is a bad deal a player sees.
    const pile = i < 10;
    s.userData = {
      pile,
      x: Math.cos(a) * r * CARD_W * 0.55, z: Math.sin(a) * r * CARD_H * 0.55,
      off: pile ? THROW - 0.03 + ((i * 7) % 10) / 10 * 0.26
                : BITE + 0.04 + ((i * 3) % 6) / 6 * 0.3,
      dur: 0.2 + (i % 5) * 0.035,
      rise: 0.95 + (i % 4) * 0.26,
      // CHUNKY. The first pass used tenth-of-a-unit streaks and the second
      // 0.17, which are four and six pixels wide on this camera — over the
      // face-up art of a discard pile they were not faint, they were absent.
      // Measured off a frozen frame rather than guessed at: nothing narrower
      // than about ten pixels survives the size this game is played at.
      w: 0.3 + (i % 3) * 0.06,
      jx: (((i * 13) % 7) / 7 - 0.5) * 0.5,
      jz: (((i * 11) % 5) / 5 - 0.5) * 0.5,
    };
    motes.push(s);
    g.add(s);
  }

  const head = new THREE.Vector3();
  const trail = new THREE.Vector3();

  kit.hold(g, SPAN, (t) => {
    // How far out the line is. The ribbon always runs the WHOLE way from the
    // card to wherever the head is, so shortening it IS the reel: the prize
    // rides the tip and the slack comes in behind it.
    let h;
    if (t < THROW) h = easeOut(t / THROW);
    else if (t < BITE) h = 1;
    else if (t < HOME) h = 1 - reel((t - BITE) / (HOME - BITE));
    else h = 0;

    // The line HAULS: its far end rises as it comes in, so the prize climbs the
    // whole way home rather than sliding along the table. The rise is spread
    // down the line by uu so the root stays pinned to the card — raising the
    // prize alone left it floating a metre off the end of its own tether,
    // which is the one thing a line must never do.
    //
    // SURFACE is the first part of that: the prize breaks clear of the pile
    // before the reel starts. Without it the bite was a dead sixth of a second
    // with the prize lying flat on the pile, where a big Graveyard's face-up
    // top card is bright art and a dark translucent card lying on it simply
    // disappeared. Thirty centimetres is enough to get a lit rim against the
    // stone behind it.
    const haul = SURFACE * easeOut(Math.min(1, Math.max(0, t - THROW + 0.03) / 0.15))
      + LIFT * (1 - h) * (t > BITE ? 1 : 0);
    // a slow writhe, so it is cloth and not a cable
    const twist = t * 9;
    for (let i = 0; i < SEG; i++) {
      const uu = i / (SEG - 1);
      path(uu * h, pts[i]);
      pts[i].y += haul * uu * uu;
    }
    strip.lay(pts, { taper: 0.45, twist });
    // The ribbon holds on almost to the end. It was cut at h < 0.28 first,
    // because a reel collapsing to nothing is a full-width strap squeezed into
    // a few centimetres and it flashed on the card as a lit plate — but that
    // left the last fifth of a second with the prize hanging in the air on no
    // line at all. The haul fixed it without the cut: by then the tip is a
    // metre up, so the last of the ribbon is a short steep leash from the card
    // to the prize rather than a plate lying on the art.
    strip.mat.opacity = Math.min(1, t / 0.05) * Math.min(1, Math.max(0, h - 0.02) / 0.08);

    // Twice: a hard short one as the line goes out, a softer one as it lands.
    // The throw was the gentler of the two to begin with and the first frames
    // of the motif then had nothing in them but a stub of ribbon — the card
    // that cast it barely registered before the eye had already followed the
    // line away across the table.
    const throwPulse = Math.max(0, 1 - t / 0.13) ** 0.8 * Math.min(1, t / 0.02);
    const catchPulse = Math.max(0, 1 - Math.abs(t - HOME) / 0.11);
    mark.material.opacity = 0.66 * Math.max(throwPulse, catchPulse * 0.72);
    mark.scale.setScalar(0.42 + (1 - throwPulse) * 0.3 + catchPulse * 0.28);

    // The pile opens as the line touches down and shuts as the prize leaves.
    const open = Math.max(0, Math.min(1, (t - THROW + 0.07) / 0.16));
    const shut = Math.max(0, Math.min(1, (t - BITE) / 0.26));
    mouth.material.opacity = 0.9 * easeOut(open) * (1 - shut);
    mouth.scale.setScalar(0.5 + easeOut(open) * 0.6 + shut * 0.35);

    // The prize breaks the surface at the bite and rides the tip home.
    if (t > THROW - 0.03) {
      path(h, head);
      head.y += haul;
      const gone = Math.max(0, (t - HOME) / (1 - HOME));
      // GOING TO HAND, in the table's own words. anim.draw already owns that
      // move — a card lifts, arcs out past the player's near corner, rolls,
      // and SHRINKS away to nothing — and a player has watched it on every
      // draw of every game. Two earlier exits were invented instead: one rose
      // straight up, which on this camera goes away from the hand and read as
      // the prize escaping, and one swelled toward the lens, which reads as a
      // thing arriving rather than a thing leaving. Copying the draw settles
      // it; the destination offsets below are anim.draw's, scaled back because
      // this one starts a metre in the air and not on the deck.
      const e = easeInOut(gone);
      prize.position.set(
        head.x + e * near * 1.5,
        head.y + Math.sin(Math.PI * gone) * 0.5,
        head.z + e * near * 3.4,
      );
      prize.rotation.x = -Math.PI / 2 + e * near * 0.9;
      prize.rotation.z = e * 0.4;
      const grow = 0.5 + easeOut(Math.min(1, (t - THROW + 0.03) / 0.22)) * 0.5;
      prize.scale.setScalar(grow * (1 - e * 0.55));
      prize.material.opacity = Math.min(1, (t - THROW + 0.03) / 0.16)
        * (1 - easeIn(Math.max(0, (gone - 0.4) / 0.6)));
    }

    for (const m of motes) {
      const u = m.userData;
      const k = (t - u.off) / u.dur;
      if (k <= 0 || k >= 1) { m.material.opacity = 0; continue; }
      if (u.pile) {
        m.position.set(B.x + u.x, B.y - 0.14 + k * u.rise, B.z + u.z);
      } else {
        // Shed IN PLACE. The first version read the path every frame at a
        // fixed distance behind the head, which meant the wake travelled along
        // with the prize instead of being left behind it — dust stapled to the
        // back of the thing shedding it. Each mote now takes the position once
        // and then only rises.
        if (u.px === undefined) {
          path(Math.min(1, h + 0.06), trail);
          u.px = trail.x + u.jx;
          u.py = trail.y + haul * 0.85;
          u.pz = trail.z + u.jz;
        }
        m.position.set(u.px, u.py + k * u.rise * 0.55, u.pz);
      }
      m.scale.set(u.w, 0.45 + k * 0.95, 1);
      m.material.opacity = Math.min(1, k * 5) * (1 - k) ** 0.8;
    }
  });

  // Light at both ends and nowhere in between: the braziers are low, and a
  // seven-unit reach lit along its whole length washes the board out.
  kit.after(THROW * SPAN, () => {
    kit.light(B, 0x7c4ae0, { power: 15, seconds: 0.42, reach: 4.0 });
  });
  kit.after(HOME * SPAN, () => {
    kit.light(A, 0x9d6cff, { power: 10, seconds: 0.3, reach: 3.0 });
  });
}
