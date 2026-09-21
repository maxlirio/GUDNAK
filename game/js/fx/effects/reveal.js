// REVEAL — a card is hauled off a deck, held up under a hard light, judged.
//
// Shared by 3 cards: R053 Ballista, A045 Inquisitorial Confessor ("Cross
// Examine"), A047 Decarceration.
// One motif, one file — worked on on its own.
//
// The Inquisition does not DRAW a card, it PRODUCES one. So this is an
// interrogation in three beats:
//
//   1. a hard lamp comes down out of nowhere and pins the opponent's deck,
//   2. the top card is dragged off the stack, up into the shaft, and turned
//      over to face the accuser,
//   3. the verdict — a white snap, and it is dropped back on the pile.
//
// What it must not be:
//   - harvest.js also hauls a card-shaped prize across this table, but that is
//     a greedy snatch: a line is thrown, it bites, and the prize is reeled out
//     of sight into a hand. Nothing is thrown here and nothing is taken away.
//     What comes out of the deck is brought a square and a half forward,
//     STOPPED, and turned to face the table — and then put back. The whole
//     point is that it was seen.
//   - the faction's own brand.js brings a tool down onto a card. Nothing is
//     pressed here. The light does all the work, which is what makes this a
//     judgement rather than a punishment.
//
// The hard light is the whole signature, and the two things that actually
// carry it are the ones a soft glow cannot fake: a POOL with a crisp rim, and
// the card's own black SHADOW thrown flat across the stone beside it.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=800&zoom=2" \
//             --eval tools/fxdemo/reveal.js --out /tmp/rv-800.png \
//             --wait 5000 --settle 700
// ?t is the moment in the MOTIF to freeze at, in ms; ?zoom crops the render
// down onto the deck being opened, because everything this motif does happens
// in the seventy pixels at the far end of the board and the wide shot cannot
// tell you whether the pool has an edge. The harness also takes ?side (who
// casts it), ?seat (which chair the camera is in — they differ only online)
// and ?deck (how tall the stack is; at 1 it is a bare plinth).

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { strongholdPosition } from '../../board.js';
import { cardTexture } from '../../textures.js';

/* ----------------------------------------------------------------- time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. Three cards share this and
// the UI is held while it runs, so it gets a sentence, not a paragraph.
const SPAN = 1.55;
const STAB = 0.11;   // the shaft is down and hard on the deck
const GRAB = 0.20;   // the top card tears loose
const UP = 0.46;     // up in the light, turned over, held
const SCAN = 0.72;   // the examination has run the length of it
const SNAP = 0.78;   // the verdict
const GONE = 0.94;   // dropped, the light out

const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const span = (t, a, b) => clamp01((t - a) / (b - a));

/* ------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map.

/**
 * The pool the lamp puts on the ground.
 *
 * HARD-EDGED on purpose. A radial blob with an even falloff is a candle, and
 * this table already has five of those burning round the board — the one thing
 * that says "a lamp was pointed at this" is a rim you can see the edge of. So
 * the middle is a flat plateau and the whole falloff happens between 0.70 and
 * 0.82 of the radius, with one faint skirt outside it to keep the cut from
 * looking like a decal.
 *
 * The plateau sits at about six tenths, not at one. At full strength, laid
 * additively over the pale flagstones of a back row, it stopped being a lit
 * floor and became a white disc with a card floating over it — the lens flare
 * this game's effects keep coming back to. Hard light is about the EDGE, not
 * about how much of it there is.
 *
 * COLD. Every other light on this table is fire — five braziers and a warm
 * key — so a lamp painted the same cream as the rest of them just reads as
 * another one of them being turned up. Blue-white is the only colour left
 * that says somebody brought equipment.
 */
let POOL = null;
function poolTexture() {
  if (POOL) return POOL;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0.00, 'rgba(238,246,255,0.66)');
  grd.addColorStop(0.55, 'rgba(232,240,252,0.60)');
  grd.addColorStop(0.70, 'rgba(222,232,246,0.50)');
  grd.addColorStop(0.755, 'rgba(206,218,236,0.15)');
  grd.addColorStop(0.82, 'rgba(190,202,222,0.06)');
  grd.addColorStop(1.00, 'rgba(160,174,196,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  POOL = t;
  return t;
}

/**
 * The shaft: a vertical alpha ramp, dense at the bottom and gone at the top.
 *
 * A cone of constant alpha has a hard lid on it where the geometry stops, and
 * from this camera — nineteen units up, looking down — that lid is in shot and
 * reads as a paper cylinder standing on the table. The ramp puts the end of
 * the beam out of sight in mid-air where a beam's end belongs. CanvasTexture
 * flips Y, so the BOTTOM row of the canvas is what lands at the foot of the
 * cylinder. White, because the beam's colour lives on the material — the map
 * is only the ramp.
 */
let SHAFT = null;
function shaftTexture() {
  if (SHAFT) return SHAFT;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.34, 'rgba(255,255,255,0.14)');
  grd.addColorStop(0.72, 'rgba(255,255,255,0.52)');
  grd.addColorStop(1.00, 'rgba(255,255,255,1)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  SHAFT = t;
  return t;
}

/**
 * The face of the card that comes up.
 *
 * It CANNOT be a real card art: the rules know which card was revealed and
 * this file does not, and painting somebody's actual Wolfpack on it would be a
 * lie told at the exact moment the motif exists to tell the truth. So it is a
 * card seen under a lamp far too bright for it — frame, art box, name bar,
 * two rules of text, all of it washed out and unreadable. That is what being
 * held up under an interrogation light does to a piece of card, and at seventy
 * screen pixels it reads as "a card, face up" and nothing else.
 *
 * Bone, not white, and the wash over it is half what it started at. Laid on
 * thickly the whole rectangle came out of ACES as one flat pale blank with a
 * couple of grey bands on it — a lens flare in the shape of a card, which is
 * the failure this game's effects keep coming back to, and it read as a
 * printed form rather than as anything anybody would play. The dark frame and
 * the dark blocks are what hold the shape together; the paper only has to be
 * the brightest thing on the table, not the brightest thing the renderer can
 * make.
 */
let FACE = null;
function faceTexture() {
  if (FACE) return FACE;
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
  // the black frame the whole thing hangs off
  g.fillStyle = '#0c0a07';
  round(0, 0, 256, 256, 14); g.fill();
  g.fillStyle = '#c6b184';
  round(12, 12, 232, 232, 9); g.fill();
  // The art box, with a figure in it, running down two thirds of the card —
  // the proportion every card in this game is drawn to, which the eye knows
  // even at seventy pixels. A modest empty box over a wide field of text read
  // as a printed form rather than as a playing card, and that one change did
  // more for it than any amount of colour.
  const sky = g.createLinearGradient(0, 22, 0, 168);
  sky.addColorStop(0, 'rgba(158,138,106,1)');
  sky.addColorStop(1, 'rgba(54,45,34,1)');
  g.fillStyle = sky;
  g.fillRect(22, 22, 212, 146);
  g.fillStyle = '#2a2319';
  g.beginPath();
  g.moveTo(92, 168); g.lineTo(102, 84); g.lineTo(128, 64); g.lineTo(154, 84);
  g.lineTo(164, 168);
  g.closePath(); g.fill();
  g.beginPath(); g.arc(128, 58, 16, 0, Math.PI * 2); g.fill();
  // name bar and rules
  g.fillStyle = '#1d180f';
  g.fillRect(22, 174, 212, 22);
  g.fillStyle = 'rgba(196,178,140,0.85)';
  g.fillRect(32, 182, 110, 7);
  for (let i = 0; i < 2; i++) {
    g.fillStyle = 'rgba(40,33,22,0.7)';
    g.fillRect(30, 208 + i * 18, [196, 148][i], 8);
  }
  // the cost pip, the one round thing on a card
  g.fillStyle = '#1d180f';
  g.beginPath(); g.arc(44, 44, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c6b184';
  g.beginPath(); g.arc(44, 44, 11, 0, Math.PI * 2); g.fill();
  // and the lamp on it: blown out along the top edge, falling off downwards
  g.globalCompositeOperation = 'lighter';
  const lit = g.createLinearGradient(0, 8, 0, 210);
  lit.addColorStop(0.00, 'rgba(255,246,222,0.34)');
  lit.addColorStop(0.45, 'rgba(255,246,222,0.11)');
  lit.addColorStop(1.00, 'rgba(255,246,222,0)');
  g.fillStyle = lit;
  round(12, 12, 232, 232, 9); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  FACE = t;
  return t;
}

/**
 * The bar of light run down the face during the examination.
 *
 * A flat quad at full strength was a white stripe painted across the card —
 * it read as a highlight on a plastic sleeve, not as something moving over
 * the art. Soft on both edges and brightest down the middle is a line of
 * light; the hard edges were the whole problem.
 */
let BAR = null;
function barTexture() {
  if (BAR) return BAR;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0.00, 'rgba(232,242,255,0)');
  grd.addColorStop(0.42, 'rgba(238,246,255,0.75)');
  grd.addColorStop(0.50, 'rgba(248,252,255,1)');
  grd.addColorStop(0.58, 'rgba(238,246,255,0.75)');
  grd.addColorStop(1.00, 'rgba(232,242,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  BAR = t;
  return t;
}

/** Dust hanging in the beam, and the grit kicked off the stack. */
let MOTE = null;
function moteTexture() {
  if (MOTE) return MOTE;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0.00, 'rgba(236,244,255,0.95)');
  grd.addColorStop(0.42, 'rgba(214,226,244,0.40)');
  grd.addColorStop(1.00, 'rgba(184,198,220,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  MOTE = t;
  return t;
}

/* ------------------------------------------------------------- the deck */

/**
 * The top of the opponent's deck, measured rather than guessed.
 *
 * The stack is one box scaled by how many cards are left, so its top slides
 * between 10cm and half a unit over a game — a fixed height had the card
 * tearing loose from inside the pile early on and from thin air late on. The
 * deck carries `deckOf` so a click can land on it, which is enough to find it
 * and measure it. An EMPTY deck is hidden rather than flattened, so a hidden
 * one means "the bare plinth", not "height zero at the origin".
 */
const BOX = new THREE.Box3();
function deckTop(kit, player) {
  let found = null;
  kit.scene?.traverse?.((o) => {
    if (o.userData?.deckOf !== player) return;
    if (!o.visible || !o.geometry) return;
    found = o;
  });
  const home = strongholdPosition(player);
  if (!found) return new THREE.Vector3(home.x, 0.11, home.z);
  const b = BOX.setFromObject(found);
  if (b.isEmpty()) return new THREE.Vector3(home.x, 0.11, home.z);
  return new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
}

/**
 * Whose deck is being pulled from.
 *
 * Two of the three cards are on the table and answer this themselves. The
 * third, Decarceration, is a Tactic: it has no piece, `kit.at` gives null, and
 * the old placeholder simply returned — so the card that reveals TWO cards was
 * the one that showed nothing at all. The Stronghold's draw halo is the only
 * thing left in the scene that knows whose turn it is (board.js lights it for
 * the active player), so it settles the fallback; if it is dark for both, the
 * far deck is the better guess, because the camera sits at the caster's seat
 * and the caster is never the one being searched.
 */
function accuserOf(kit, at) {
  const piece = kit.piece?.(at);
  if (piece && (piece.owner === 0 || piece.owner === 1)) return piece.owner;
  let lit = -1, best = 0.02;
  kit.scene?.traverse?.((o) => {
    const p = o.userData?.deckOf;
    if ((p !== 0 && p !== 1) || !o.parent) return;
    for (const sib of o.parent.children) {
      const m = sib.material;
      if (!m || m.blending !== THREE.AdditiveBlending) continue;
      if (m.opacity > best) { best = m.opacity; lit = p; }
    }
  });
  return lit >= 0 ? lit : 0;
}

/* -------------------------------------------------------------- the act */

export function reveal(kit, at) {
  if (!kit?.scene) return;
  const owner = accuserOf(kit, at);             // who ordered it
  const foe = 1 - owner;                        // whose deck is opened
  const top = deckTop(kit, foe);

  const g = new THREE.Group();

  /* ------------------------------------------------ where it is judged */

  // NOT over the deck. That was the first staging, and its close-ups looked
  // right while the actual game view did not: a Stronghold sits at the very
  // edge of the frame, and a card lifted a unit and a half above the far one
  // goes off the top of the board and in behind the hint text. A perfectly
  // good motif happening in the worst sixty pixels on screen.
  //
  // So the lamp finds the deck, and then DRAGS what it found forward, out over
  // the accused's own back row where there is room to hold it up. That is the
  // better picture anyway: something produced from the pile and brought into
  // the open in front of everybody, rather than something done quietly in the
  // corner where it was found.
  const fz = top.z >= 0 ? -1 : 1;    // from that deck, toward the board
  const DOCK = 3.7;                  // how far forward it is hauled
  const LIFT = 1.7;                  // and how high

  /* --------------------------------- the lamp: a light, and a beam seen */

  // The lamp hangs high and OFF TO ONE SIDE, never straight overhead.
  //
  // This camera is nineteen units up and pitched 52 degrees, which flattens
  // height brutally: a vertical beam is seen end-on, and the first version —
  // an upright cone over the deck — was not faint, it was foreshortened into
  // nothing at all. Leaning it sideways costs nothing and buys everything,
  // because sideways is the one direction this camera does not compress. The
  // beam crosses the screen, and so does the shadow it throws.
  //
  // It leans toward the accuser's side, so from the seat the camera is
  // actually sitting in the light always comes from the same hand.
  //
  // HIGH, as well as out. Hung at three and a half units the card's shadow
  // came out at twice life size — a three-unit black slab lying over the dirt
  // that read as a hole in the ground rather than as anything's shadow. Six
  // keeps the angle and brings the shadow back to about a card and a half.
  const sx = owner === 0 ? 1 : -1;
  const HANG = 6.0;                  // above the GROUND, not above the stack
  const LEAN = 1.9;

  // Lamp, beam and pool are one rig moved as a unit, because they are one
  // object: a lamp on a boom, swung from the deck to the dock and back. Moved
  // separately they drift apart, and a beam that misses its own pool is worse
  // than no beam.
  const rig = new THREE.Group();
  g.add(rig);

  // A real light as well as the drawn beam. The braziers on this table are low
  // and warm; a cold one hung over the plinth repaints the stone, the deck's
  // own edges and the dirt around it, and that whole corner of the board
  // changes temperature — which no additive quad can do.
  const lamp = new THREE.PointLight(0xe9eff8, 0, 13, 2);
  lamp.position.set(sx * LEAN, HANG, 0);
  rig.add(lamp);

  // The beam. Narrow at the lamp and spread at the foot — the opposite of the
  // cone brand.js brings its iron down, because that one is a tool arriving
  // and this one is a lamp throwing. Open-ended and double-sided so the far
  // wall shows through the near one.
  const aim = new THREE.Vector3(-sx * LEAN, 0.1 - HANG, 0);
  const SHAFT_H = aim.length() + 1.1;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.98, SHAFT_H, 26, 1, true),
    new THREE.MeshBasicMaterial({
      map: shaftTexture(), transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: 0xd2dcee,
    }),
  );
  const along = aim.clone().negate().normalize();
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
  shaft.position.copy(lamp.position).addScaledVector(along, -(SHAFT_H / 2 - 0.55));
  shaft.renderOrder = 3;
  rig.add(shaft);

  const quad = (parent, size, x, y, z, order, blend, map = poolTexture()) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map, transparent: true, opacity: 0, depthWrite: false,
        blending: blend || THREE.NormalBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = order;
    parent.add(m);
    return m;
  };

  // The pool, on the ground, travelling with the rig. Elongated along the
  // lean, because a lamp off to one side throws an ellipse and a circle would
  // have handed the whole thing back its overhead look, and offset AWAY from
  // the lamp, because a tilted beam's footprint stretches down-range — which
  // is also where the card's shadow lands, so biasing it that way puts the
  // black shape on the bright stone rather than half on and half off it.
  //
  // Ten centimetres up: that clears the plinth's top by two and the flagstones
  // by two, and at 41 pixels to the world unit neither gap is a pixel wide.
  const pool = quad(rig, 2.7, -sx * 0.4, 0.10, 0, 1, THREE.AdditiveBlending);
  pool.material.color.setHex(0x7d838f);
  pool.scale.set(1.35, 1, 1);

  // and a harder one on the top of the stack, which stays where the stack is.
  // Half a unit above the ground, so it cannot share a quad with the pool.
  const hot = quad(g, CARD_W * 1.7, top.x, top.y + 0.012, top.z, 2,
    THREE.AdditiveBlending);
  hot.material.color.setHex(0x646b78);

  /* ------------------------------------ the shadow the held card throws */

  // The cheapest thing in the file and the one that does the most work. A card
  // hanging in the air over a lit board is a floating rectangle; the same card
  // with its own hard black shape thrown across the flagstones is a card being
  // HELD UP under something. Projected properly — lamp, through card, onto the
  // ground plane — so it grows and slides as the card rises, and squashed
  // along the table by however far the card has turned over.
  //
  // Two things had to be got right before any of it showed up at all.
  //
  // `map` is passed in rather than cleared afterwards: setting material.map to
  // null on a built material needs needsUpdate with it, because the program
  // was compiled with a sampler in it. Without that this quad sampled a
  // texture that was no longer there and drew nothing.
  //
  // And it is drawn AFTER the beam. At renderOrder 2 the shaft's additive cone
  // went down on top of it and put the light straight back — the shadow was in
  // the scene, in the right place, and about a tenth as dark as it should have
  // been, which reads as dirty stone rather than as a shadow.
  const shade = quad(g, CARD_W, top.x, 0.102, top.z, 4, null, null);
  shade.material.color.setHex(0x06050c);
  shade.scale.set(1, 0.001, 1);

  /* --------------------------------------------------------- the card */

  // Face DOWN on the stack and face UP in the light: it is the turning over
  // that makes this a reveal, so the object has two real sides. The top is the
  // deck's own card back, which is what makes it unmistakably a card off THAT
  // pile and not a card-shaped prop conjured over it.
  //
  // Basic materials, not standard ones. The lamp is the only light that is
  // meant to be on this card, and a lit material put the braziers back on its
  // face and made the whole thing warm — the one colour this faction is not.
  // Brightness is driven by material.color instead, so the card visibly comes
  // UP into the light rather than arriving already lit.
  const edge = new THREE.MeshBasicMaterial({ color: 0x14110c, transparent: true });
  const back = new THREE.MeshBasicMaterial({
    map: cardTexture('../site/assets/card-back.jpg'), transparent: true, color: 0x4a443c,
  });
  const face = new THREE.MeshBasicMaterial({
    map: faceTexture(), transparent: true, color: 0x2b281f,
  });
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W, 0.055, CARD_H),
    [edge, edge, back, face, edge, edge],   // +X -X +Y -Y +Z -Z
  );
  // Turned about its own axis for the far seat. The two seats tilt the card
  // opposite ways so that it always faces the accuser, and that alone put the
  // art upside down for player two — name bar at the top, cost pip in the
  // bottom corner. Flipping the mesh inside the group cancels it, and because
  // both the tilt and this flip invert together, the scan bar below still
  // sweeps from the card's top edge downward for either seat.
  card.rotation.y = owner === 0 ? 0 : Math.PI;
  card.renderOrder = 5;
  // A shade over life size: it is being held up to be LOOKED at, and a card
  // exactly the size of the ones lying on the board read as one of them.
  card.scale.setScalar(1.2);
  const held = new THREE.Group();
  held.position.set(top.x, top.y + 0.06, top.z);
  held.add(card);
  held.visible = false;
  g.add(held);

  // The card turns to face the ACCUSER, who is also where the camera sits, so
  // the two seats flip it opposite ways. Three quarters of a turn, not a half:
  // at a flat 180 degrees the face lies parallel to the table and this camera
  // is looking straight down the edge of it.
  const TURN = (owner === 0 ? -1 : 1) * Math.PI * 0.75;

  // the examination: one bar of light run down the face, top to bottom
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.02, 0.34),
    new THREE.MeshBasicMaterial({
      map: barTexture(), color: 0xeaf1fb, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  bar.rotation.x = Math.PI / 2;               // lies in the face, pointing -Y
  bar.position.y = -0.035;
  bar.renderOrder = 6;
  card.add(bar);

  /* ------------------------ dust in the beam, and grit off the stack */

  // Two populations with nothing in common but a texture. The grit is struck
  // off the pile when the card tears loose and stays at the pile; the dust
  // hangs in the beam and travels with the rig, which is what says the shaft
  // has air in it rather than being a painted wedge.
  const motes = [];
  for (let i = 0; i < 22; i++) {
    const kick = i < 8;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moteTexture(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const a = i * 2.39996;
    const r = Math.sqrt((i + 0.5) / 22) * 1.0;
    s.userData = {
      kick,
      x: Math.cos(a) * (kick ? 0.7 + r * 0.5 : r) + (kick ? 0 : sx * 0.25),
      z: Math.sin(a) * (kick ? 0.7 + r * 0.5 : r),
      off: kick ? GRAB - 0.01 + (i % 4) * 0.02 : STAB + ((i * 5) % 11) / 11 * 0.45,
      dur: kick ? 0.2 + (i % 3) * 0.05 : 0.45 + ((i * 3) % 7) / 7 * 0.4,
      rise: kick ? 0.5 + (i % 3) * 0.2 : 0.6 + ((i * 7) % 5) / 5 * 0.6,
      y0: kick ? top.y + 0.05 : 0.3 + ((i * 11) % 9) / 9 * 2.0,
      size: kick ? 0.13 + (i % 3) * 0.03 : 0.07 + ((i * 2) % 5) / 5 * 0.06,
    };
    motes.push(s);
    (kick ? g : rig).add(s);
  }

  /* ------------------- the accuser's own card, so the order has a source */

  // The deck is up to six units from whatever cast this, and with no mark at
  // the near end the lamp reads as weather rather than as something a card on
  // the board did. A flat hard pool on the caster for a fifth of a second, and
  // the ring the rest of the faction uses, is enough — a drawn line between
  // the two ends is harvest.js's gesture and would say the wrong thing.
  const src = kit.at?.(at);
  let mark = null;
  if (src) {
    mark = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.5, CARD_H * 1.5),
      new THREE.MeshBasicMaterial({
        map: poolTexture(), transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0x9a9484,
      }),
    );
    mark.rotation.x = -Math.PI / 2;
    // kit.at answers about 0.2 for a card whose face is at 0.21, and under
    // about +0.05 the depth test fails on equal and the mark draws only on the
    // stone AROUND the card it is supposed to be on.
    mark.position.set(src.x, Math.min(src.y, 0.225) + 0.055, src.z);
    mark.renderOrder = 4;
    g.add(mark);
    // 2.8, not 2.0: kit.ring is drawn at y = 0.1, under a card whose face is
    // at 0.21, so it spends most of its life inside the card that cast it. At
    // 2.0 it never got past the card's own edges at all; much above 3 it stops
    // being a ring and parks a flat slab on the square.
    kit.ring(src, 0xdfe8f5, { size: 2.8, seconds: 0.42 });
  }

  /* ---------------------------------------------------------- the timeline */

  kit.hold(g, SPAN, (t) => {
    /* the lamp */
    const on = span(t, 0.01, STAB);
    const out = 1 - span(t, SNAP + 0.10, GONE);
    // the verdict is a hard spike, not a fade: the light is slammed on for two
    // frames and then the whole thing is over
    const verdict = Math.max(0, 1 - Math.abs(t - SNAP) / 0.07) ** 1.5;
    lamp.intensity = (52 + 115 * verdict) * easeOut(on) * out;
    shaft.material.opacity = (0.52 + 0.40 * verdict) * easeOut(on) * out;
    pool.material.opacity = (0.85 + 0.15 * verdict) * easeOut(on) * out;
    // THE VERDICT IS THE LIGHT CLOSING IN. Brightening alone was not a beat at
    // all — the frame at the moment of judgement looked like the frame half a
    // second before it with the exposure pushed. A lamp that snaps down to a
    // narrow hard column on the card, for a tenth of a second, is something
    // that HAPPENS, and it is what the rest of this faction does with iron.
    shaft.scale.set(1 - 0.42 * verdict, 1, 1 - 0.42 * verdict);
    pool.scale.set(1.35 * (1 - 0.34 * verdict), 1, 1 - 0.34 * verdict);

    /* the haul */
    // One curve does the rise, the carry forward and the drop, so the card
    // never leaves the middle of its own beam. Two curves were tried and the
    // beam arrived at the dock a third of a second before the card did.
    const lift = span(t, GRAB, UP);
    const fall = span(t, SNAP + 0.02, GONE);
    const up = easeOut(lift) * (1 - easeIn(fall));
    rig.position.set(top.x, 0, top.z + fz * DOCK * up);
    hot.material.opacity = (0.3 + 0.5 * verdict) * easeOut(on) * out * (1 - 0.6 * up);

    /* the card */
    held.visible = t > GRAB - 0.02;
    held.position.set(top.x, top.y + 0.06 + up * LIFT, top.z + fz * DOCK * up);
    // a shudder as it tears off the stack — it is being pulled, not floating
    if (lift > 0 && lift < 0.4) held.position.y += Math.sin(lift * 46) * 0.035 * (1 - lift / 0.4);
    held.position.y -= 0.13 * verdict;        // it takes the verdict on the chin
    // It comes back down FLAT. Held at three quarters of a turn all the way
    // to the floor it went home stood on its edge, foreshortened to a sliver
    // by this camera, and the last thing the motif did was vanish rather than
    // land. A card put back on a pile lies down on it.
    const tilt = TURN * easeOut(clamp01(lift * 1.15)) * (1 - fall);
    held.rotation.x = tilt;
    held.rotation.z = Math.sin(t * 3.1) * 0.035 * up;
    // it comes up INTO the light: the back goes from deck-dark to lit, and the
    // face stays dim until it has actually turned over
    const litness = easeOut(lift) * (0.85 + 0.15 * verdict);
    back.color.setScalar(0.29 + 0.5 * litness);
    face.color.setScalar(0.20 + 0.70 * litness);
    edge.color.setRGB(0.08 + 0.1 * litness, 0.07 + 0.09 * litness, 0.05 + 0.07 * litness);
    // and it is opaque until it is home. Fading it out over the whole descent
    // meant the card was already a ghost by the time it reached the stack.
    const vanish = 1 - span(t, GONE - 0.01, GONE + 0.05);
    back.opacity = face.opacity = edge.opacity = vanish;

    /* the shadow */
    // lamp -> card -> ground, solved for the ground plane. |cos(tilt)| is how
    // much of the card still faces the lamp, and so how much of it the lamp
    // can lay on the floor.
    const lx = rig.position.x + sx * LEAN, lz = rig.position.z;
    const drop = (shade.position.y - HANG) / (held.position.y - HANG);
    shade.position.x = lx + drop * (held.position.x - lx);
    shade.position.z = lz + drop * (held.position.z - lz);
    shade.material.opacity = 0.72 * easeOut(on) * up * out;
    shade.scale.set(drop, drop * Math.max(0.02, Math.abs(Math.cos(tilt))), 1);

    /* the examination */
    const look = span(t, UP - 0.04, SCAN);
    bar.material.opacity = look > 0 && look < 1
      ? 0.62 * Math.min(1, look * 6) * (1 - look) ** 0.6 : 0;
    bar.position.z = (0.5 - look) * CARD_H * 1.06;

    /* the dust */
    for (const m of motes) {
      const u = m.userData;
      const k = (t - u.off) / u.dur;
      if (k <= 0 || k >= 1) { m.material.opacity = 0; continue; }
      if (u.kick) m.position.set(top.x + u.x, u.y0 + k * u.rise - k * k * 0.55, top.z + u.z);
      else m.position.set(u.x, u.y0 + k * u.rise, u.z);
      m.scale.setScalar(u.size * (1 - k * 0.3));
      m.material.opacity = (u.kick ? 0.9 : 0.5) * Math.min(1, k * 5) * (1 - k) ** 0.9 * out;
    }

    /* the accuser */
    if (mark) {
      const call = Math.max(0, 1 - t / 0.16) ** 0.8 * Math.min(1, t / 0.02);
      mark.material.opacity = Math.min(1, 1.25 * Math.max(call, verdict * 0.35));
      mark.scale.setScalar(0.5 + (1 - call) * 0.22 + verdict * 0.2);
    }
  });

  // A hard white at the moment of the verdict, sitting a card's width above
  // the face rather than on it: a point light decays with the square of the
  // distance, and one parked on the card blows a featureless disc through the
  // middle of the thing the motif exists to show.
  kit.after(SNAP * SPAN, () => {
    kit.light(new THREE.Vector3(top.x, LIFT + 0.9, top.z + fz * DOCK), 0xeef4ff,
      { power: 16, seconds: 0.26, reach: 5 });
  });
}
