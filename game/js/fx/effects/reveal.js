// REVEAL — a card is hauled off a deck, held up under a hard light, and SHOWN
// TO YOU long enough to read.
//
// Shared by 3 cards: R053 Ballista, A045 Inquisitorial Confessor ("Cross
// Examine"), A047 Decarceration.
// One motif, one file — worked on on its own.
//
// The Inquisition does not DRAW a card, it PRODUCES one. So this is an
// interrogation in four beats:
//
//   1. a hard lamp comes down out of nowhere and pins the opponent's deck,
//   2. the top card is dragged off the stack, out into the middle of the
//      table, and turned over to face whoever is watching,
//   3. IT IS HELD THERE, still, square-on and large, for as long as it takes
//      to read the name and the rules text,
//   4. the verdict — a white snap, and it is put back on the pile.
//
// Beat 3 is the reason this file was reworked. The user's note: "make the
// reveal one at least give you the option to view it for a little bit before
// returning it to the top of the deck." The rules DO pause here — all three
// cards `yield` a choice — but the pause happens before the animation: the
// engine resolves the whole ability and only then does `defaultCast` leave the
// note this motif is played from. So the prompt is answered while the card is
// still invisible, and the motif itself is the only place the card is ever
// seen. Holding it is therefore this file's job and nobody else's, which is
// why SPAN below is more than twice what it was.
//
// What it must not be:
//   - harvest.js also hauls a card-shaped prize across this table, but that is
//     a greedy snatch: the discard pile gives up its dead and they leave for a
//     hand. Nothing is taken away here. What comes out of the deck is brought
//     into the middle of the board, STOPPED, turned to face the table — and
//     then put back. The whole point is that it was seen.
//   - the faction's own brand.js brings a tool down onto a card. Nothing is
//     pressed here. The light does all the work, which is what makes this a
//     judgement rather than a punishment.
//
// The hard light is the signature, and the two things that actually carry it
// are the ones a soft glow cannot fake: a POOL with a crisp rim, and the
// card's own black SHADOW thrown flat across the stone beside it.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=1600" \
//             --eval tools/fxdemo/reveal.js --out /tmp/rv-1600.png \
//             --wait 10000 --settle 700
// ?t is the moment in the MOTIF to freeze at, in ms; ?zoom crops the render
// down onto the deck being opened, for the beats that still happen in the
// seventy pixels at the far end of the board. The hold itself is judged at
// ?zoom=0 and nowhere else — the whole question is whether the card reads at
// the size the game is actually played at. The harness also takes ?side (who
// casts it), ?seat (which chair the camera is in — they differ only online),
// ?deck (how tall the stack is; at 1 it is a bare plinth) and ?id (which card
// is turned over).

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { strongholdPosition } from '../../board.js';

/* ----------------------------------------------------------------- time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
//
// THREE AND A HALF SECONDS, and nearly two of them are one still frame. That
// is a long motif for this game and it is the point: the UI is held while the
// animator is busy, so this span IS the pause the player gets to read the card
// in, and at the old 1.55 — with a third of a second at the top — the card was
// gone before the eye had finished finding the name. A player who does not
// want the whole look can cut it short; see `skip` at the foot of this file.
const SPAN = 3.5;
const STAB = 0.045;  // the shaft is down and hard on the deck
const GRAB = 0.085;  // the top card tears loose
const UP = 0.245;    // out in the middle, turned over, square-on, full size
const SCAN = 0.35;   // the examination has run the length of it
const READ = 0.80;   // the end of the still hold — this is the beat that matters
const SNAP = 0.835;  // the verdict
const GONE = 0.985;  // back on the pile, the light out

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
 * THERE IS NO FACE TEXTURE IN THIS FILE ANY MORE.
 *
 * What stood here drew one: a generic card seen under a lamp far too bright
 * for it — frame, art box, name bar, two rules of text, all of it washed out
 * and unreadable. The note that went with it said the motif "doesn't know
 * which card was revealed and must not lie about it", and at the time that was
 * true and it was the right call.
 *
 * It is history now. `ops.noteCards` names the card the rules turned over,
 * `fx.js` hands the whole event to the motif, and `kit.card(id)` returns the
 * REAL printed face on the same slab the table's own pieces are. A motif whose
 * entire subject is a card being shown to you cannot show a drawing of one —
 * that is the user's rule, and this was the clearest case of it in the game.
 *
 * Nothing replaces it when the id is missing or unknown: `kit.card` answers
 * null, the lamp and the beam and the pool all still play, and no card comes
 * off the deck. A beat with nothing in it beats a blank slab.
 */

/* -------------------------------------------------------------- the lens */

/**
 * The camera, borrowed from the first thing this motif draws.
 *
 * The card is turned SQUARE-ON to whoever is looking at it, the way
 * right-click inspect turns one in pieces.js, and that is only possible if the
 * motif knows where the lens is. Nothing in `kit` hands it over, so the ground
 * pool — which is in the scene from the first frame — is used as a peephole:
 * three.js calls onBeforeRender with the camera it is drawing for.
 *
 * `near` is the discriminator, NOT `isPerspectiveCamera` on its own. The key
 * light in this arena is a SpotLight and a spot's shadow camera is a
 * perspective one too, pulled in tight at near = 22; the table's camera sits
 * at near = 0.5. Catching the sun's would have turned the card to face the
 * sun for one frame in every two.
 */
let CAM = null;
const peep = (renderer, scene, cam) => {
  if (cam.isPerspectiveCamera && cam.near < 5) CAM = cam;
};

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

export function reveal(kit, at, faction, ev) {
  if (!kit?.scene) return;
  const owner = accuserOf(kit, at);             // who ordered it
  const foe = 1 - owner;                        // whose deck is opened
  const top = deckTop(kit, foe);

  const g = new THREE.Group();

  /* ------------------------------------------------ where it is judged */

  // NOT over the deck, and no longer over the accused's back row either.
  //
  // Over the deck was the first staging, and its close-ups looked right while
  // the actual game view did not: a Stronghold sits at the very edge of the
  // frame, and a card lifted a unit and a half above the far one goes off the
  // top of the board and in behind the hint text. The second staging dragged
  // it two squares forward, which fixed the framing and not the SIZE — the
  // held card measured seventy-odd pixels across, which is fine for a
  // silhouette and hopeless for a card you are meant to read.
  //
  // So it is hauled the whole way out now, to one fixed spot: the middle of
  // the table, a couple of units up, leaned toward the seat the camera is in.
  // Same place whichever deck was opened, which is what makes it a PRESENTED
  // card rather than something happening in the corner it was found in, and
  // close enough to the lens that the printing on it is legible.
  const fz = top.z >= 0 ? -1 : 1;    // from that deck, toward the board
  const READ_FWD = 3.4;              // how far toward the camera's seat
  const READ_Y = 3.3;                // and how high off the stone
  // Nearly four times life size, which puts the card about 250 pixels across
  // at the size the game is actually played at — measured, not guessed, and
  // the number the rules text stops being mush at.
  //
  // The table's own right-click inspect grows a card by 2.35, and that is the
  // gesture this is copying, but it is not the whole of it: an inspected card
  // is also PULLED 2.6 units along the camera's bearing, which is worth as
  // much again. The three numbers above are the same trick spent differently —
  // a fixed spot out in front instead of a card leaving its own square — and
  // they are tied together. READ_Y cannot come down without the card's bottom
  // corner dipping into the near Stronghold's plinth, which sits between the
  // camera and the reading spot and put a stone lintel across one line of the
  // rules text; READ_S cannot go up much without the top edge reaching the
  // hint text along the top of the screen. Both were photographed.
  const READ_S = 3.7;

  // The lens, and the pose that turns the card square-on to it. Recomputed
  // every frame in the tick because CAM is not filled in until the first
  // render; the fallback is only ever used for frame one. Its numbers are
  // main.js's CAM_HEIGHT and CAM_DIST, and the seat is the ACCUSER's — the
  // camera never sits at the end being searched — which `fz` already knows.
  const FALLBACK = new THREE.Vector3(0, 19.4, fz * 18.6);
  const camAt = new THREE.Vector3();
  const readAt = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  let bearing = 0;
  let faceTilt = 0.8;
  const lens = () => {
    camAt.copy(CAM ? CAM.position : FALLBACK);
    const flat = Math.hypot(camAt.x, camAt.z) || 1;
    readAt.set(camAt.x / flat * READ_FWD, READ_Y, camAt.z / flat * READ_FWD);
    toCam.copy(camAt).sub(readAt);
    // The card is YAWED ONTO THE CAMERA'S BEARING and then tipped inside that
    // frame, which is one step more than pieces.js does.
    //
    // pieces.js snaps the yaw to 0 or a half turn and leans only in z, and
    // that is exact for the table's own camera because it sits at x = 0 at
    // either end. It is exact right up until the camera is somewhere else —
    // the seat swing takes a second to cross, and the idle sway moves the lens
    // a third of a unit sideways all the time — and then a card leaned purely
    // in z is leaned along the wrong axis: the preview harness caught it as a
    // card ROLLED thirteen degrees out of level while the camera was still
    // swinging to the far seat. Turning the whole holder to face the lens
    // first makes the lean always the right lean, and the tip inside it is
    // then a single positive angle with no sign to get wrong.
    bearing = Math.atan2(toCam.x, toCam.z);
    faceTilt = Math.atan2(Math.hypot(toCam.x, toCam.z), toCam.y);
  };
  lens();

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
  // the peephole: this is the one mesh that is on screen from the first frame
  pool.onBeforeRender = peep;

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

  // THE REAL CARD, off the real deck.
  //
  // `kit.card` builds the table's own slab — the printed face on +Y, the
  // deck's card back on -Y, matching thickness and proportion — so what the
  // lamp turns over is the same object the player would pick up. It answers
  // null for a bare note or an id nothing knows, and then the lamp, the beam,
  // the pool and the grit all still play and nothing comes off the deck.
  const card = kit.card?.(ev?.cards?.[0], { thickness: 0.05 }) || null;
  const mats = [];
  const held = new THREE.Group();
  const face = new THREE.Group();          // the turn lives here, the yaw below
  held.position.set(top.x, top.y + 0.06, top.z);
  held.add(face);
  held.visible = false;
  g.add(held);

  if (card) {
    // MATTE, and it matters more here than anywhere. The table's own cards are
    // 0.55 rough and lit by a spotlight forty units away, which never puts a
    // highlight on one; this card has a lamp a couple of feet off its face,
    // and at 0.55 that lamp laid a hard white blob across the middle of the
    // rules text — a glare sitting on the one thing the motif exists to show.
    // Paper is matte.
    //
    // Transparent, and drawn LAST. The shaft is an additive cone with the card
    // standing inside it: left in the opaque pass the card is drawn first and
    // the beam paints straight over the printing. renderOrder 6 against the
    // shaft's 3 puts the card on top of its own light, which is also what a
    // lit card looks like.
    for (const m of card.material) {
      if (mats.includes(m)) continue;      // four edges, one material
      m.transparent = true;
      m.roughness = 0.9;
      mats.push(m);
    }
    // The motif throws the card's shadow itself, projected lamp-through-card
    // onto the ground plane. Left casting a real one as well it had two, at
    // different angles, and the pair read as a double exposure.
    card.castShadow = false;
    card.renderOrder = 6;
    face.add(card);
  }

  // The card is turned SQUARE-ON, not three-quarters over.
  //
  // The old turn was 135 degrees — enough to get the face off the table and
  // into view, and deliberately short of flat because a card at 180 lies
  // parallel to the stone and this camera looks straight down its edge. That
  // was the right compromise for a silhouette. It is the wrong one for
  // something you are meant to READ: three quarters over, the printing is
  // foreshortened to about seven tenths and the rules text on the lower half
  // is the part that loses. `faceTilt` — recomputed from where the lens
  // actually is, the same way right-click inspect does it — puts the face flat
  // on to the viewer, and then the only thing deciding whether the writing is
  // legible is how big it is.
  //
  // It still starts face DOWN, a half turn from the reading pose, because the
  // turning over is what makes this a reveal: what comes up off the pile is
  // the deck's own card back, and it rolls over on the way out. The holder's
  // +Z already points at the lens, so a positive tip is always the tip TOWARD
  // the reader and PI is always face down on the pile — there is no sign left
  // in here to get wrong.
  const START = Math.PI;

  // the examination: one bar of light run down the face, top to bottom
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.02, 0.30),
    new THREE.MeshBasicMaterial({
      map: barTexture(), color: 0xeaf1fb, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  // lies IN the face, which is now the +Y one — kit.card is the table's slab
  // and the table's slab is printed on top. The old bar sat under a hand-built
  // box whose face was on -Y, and left there it would have swept the card's
  // back.
  bar.rotation.x = -Math.PI / 2;
  bar.position.y = 0.032;
  bar.renderOrder = 7;
  if (card) card.add(bar);

  // THE READING LAMP.
  //
  // A real card is a LIT object and the key light in this arena is a spotlight
  // confined to the flagstones, so a card held three units above them gets
  // almost nothing: photographed without this it was a dark rectangle with a
  // cold rim on it, which is exactly what arcane.js and recall.js each had to
  // discover for themselves. Warm and close to white, because the cold
  // interrogation lamp is the SCENE's colour and a card printed in blue-white
  // is a card whose faction you cannot name.
  //
  // Reach 5.0 and decay 1.7. The reach is short so that what it lights is the
  // card and nothing else — at 8 it lit the squares underneath and the whole
  // middle of the board brightened for two seconds for no reason a player
  // could name — and the decay is under 2 because a quadratic lamp this close
  // to a card five units tall is far brighter at the middle than at the
  // corners. It rides in FRONT of the face, along the card's own normal, so it
  // follows the turn instead of raking across it.
  const readL = card ? new THREE.PointLight(0xfff1dc, 0, 5.0, 1.7) : null;
  if (readL) g.add(readL);
  const normal = new THREE.Vector3();

  /* ------------------------ dust in the beam, and grit off the stack */

  // Two populations with nothing in common but a texture. The grit is struck
  // off the pile when the card tears loose and stays at the pile; the dust
  // hangs in the beam and travels with the rig, which is what says the shaft
  // has air in it rather than being a painted wedge.
  //
  // Every duration here is a FRACTION of SPAN, so more than doubling the span
  // for the hold stretched them all with it: grit took seven tenths of a
  // second to leave the pile and drifted like ash, and the dust had all blown
  // through before the card was halfway out, leaving the beam an empty wedge
  // for the two seconds the player is actually looking at it. The grit is back
  // to the tenth of a second it was, and the dust RECYCLES — see the tick —
  // so the shaft has air in it for as long as the shaft is lit.
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
      off: kick ? GRAB - 0.01 + (i % 4) * 0.009 : STAB + ((i * 5) % 11) / 11 * 0.2,
      dur: kick ? 0.09 + (i % 3) * 0.022 : 0.2 + ((i * 3) % 7) / 7 * 0.18,
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
    // The window is a fraction of SPAN, so doubling the span for the hold
    // doubled the verdict with it: a quarter-second spike became half a second
    // of slow brightening, which is a mood and not a decision. 0.032 of three
    // and a half seconds is the tenth of a second it always was.
    const verdict = Math.max(0, 1 - Math.abs(t - SNAP) / 0.032) ** 1.5;
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
    // One curve does the rise, the carry out and the drop, so the card never
    // leaves the middle of its own beam. Two curves were tried and the beam
    // arrived at the reading spot a third of a second before the card did.
    //
    // And it HOLDS. `lift` is at 1 from UP all the way to the verdict, which
    // is the whole point of the rework: between those two moments the card
    // does not move, does not turn and does not change size, because a card
    // that is still drifting is a card the eye is still tracking rather than
    // reading.
    const lift = span(t, GRAB, UP);
    const fall = span(t, SNAP + 0.02, GONE);
    const up = easeOut(lift) * (1 - easeIn(fall));
    lens();
    rig.position.set(
      top.x + (readAt.x - top.x) * up, 0, top.z + (readAt.z - top.z) * up);
    hot.material.opacity = (0.3 + 0.5 * verdict) * easeOut(on) * out * (1 - 0.6 * up);

    /* the card */
    held.visible = !!card && t > GRAB - 0.02;
    held.position.set(
      top.x + (readAt.x - top.x) * up,
      top.y + 0.06 + (readAt.y - top.y - 0.06) * up,
      top.z + (readAt.z - top.z) * up,
    );
    // a shudder as it tears off the stack — it is being pulled, not floating
    if (lift > 0 && lift < 0.4) held.position.y += Math.sin(lift * 46) * 0.035 * (1 - lift / 0.4);
    // It takes the verdict on the chin. A third of a unit and a six per cent
    // flinch, not the tenth of a unit it was: the beam narrowing and the pool
    // shrinking are both hidden behind the card now, so what the player can
    // actually see of the judgement is what it does to the card.
    held.position.y -= 0.34 * verdict;
    // It comes back down FLAT. Held square-on all the way to the floor it went
    // home stood on its edge, foreshortened to a sliver by this camera, and
    // the last thing the motif did was vanish rather than land. A card put
    // back on a pile lies down on it. `START` is a half turn, so the same
    // number that opens the card closes it.
    const turn = easeOut(clamp01(lift * 1.15)) * (1 - fall);
    const tilt = START + (faceTilt - START) * turn;
    held.rotation.y = bearing;
    face.rotation.x = tilt;
    face.rotation.z = Math.sin(t * 3.1) * 0.02 * up * (1 - lift);
    if (card) {
      // It GROWS on the way out, the way an inspected card does, rather than
      // arriving already three times life size. Coming off the pile at full
      // scale it was wider than the plinth it was lying on.
      card.scale.setScalar((1 + (READ_S - 1) * easeOut(clamp01(lift * 1.1)) * (1 - fall))
        * (1 - 0.06 * verdict));
    }
    // It comes up INTO the light. The colour multiplier is the map's own, so
    // this is the card being dim on the pile and lit in the air rather than
    // the card being repainted: 0.42 is a card face seen by the braziers, 1 is
    // a card face under a lamp aimed at it. It stops at 1 — pushed past it in
    // the verdict the printing blew out, which is the failure this whole file
    // is about.
    const litness = easeOut(lift) * (1 - fall);
    // ...and then the verdict drives it PAST one for a tenth of a second, on
    // purpose. The narrowing beam and the shrinking pool that used to carry
    // this beat are both on the ground underneath a card that now fills a
    // quarter of the screen, so neither of them is visible any more and the
    // frame at the moment of judgement looked exactly like the frame two
    // seconds before it. The card itself is the only thing left in shot, so
    // the card is what is slammed white — and it is safe to do now in a way it
    // never was before, because the reading is over by READ and this happens
    // after it.
    const shade0 = (0.42 + 0.58 * litness) * (1 + 1.5 * verdict);
    for (const m of mats) m.color.setScalar(shade0);
    // and it is opaque until it is home. Fading it out over the whole descent
    // meant the card was already a ghost by the time it reached the stack.
    const vanish = 1 - span(t, GONE - 0.01, GONE + 0.05);
    for (const m of mats) m.opacity = vanish;

    /* the reading lamp, riding in front of the face */
    if (readL) {
      // The card's own +Y normal, turned by `tilt` INSIDE the holder and then
      // by the holder's own yaw onto the camera's bearing — the lamp sits out
      // along it. Left in the holder's frame the lamp went out along world +z
      // whichever way the card was facing, so at the far seat it was behind
      // the card lighting its back.
      const sy = Math.sin(tilt);
      normal.set(Math.sin(bearing) * sy, Math.cos(tilt), Math.cos(bearing) * sy);
      // 2.8 out, not 1.55. A card nearly four times life size is over
      // six units corner to corner, and a lamp a unit and a half off its face
      // is three times closer to the middle of it than to the bottom corners:
      // the name lit and the rules text in shadow, which is precisely the
      // wrong half to lose. Backing the lamp off flattens the falloff.
      // Dropped a little BELOW the centre line for the same reason — the
      // writing is on the bottom half of every card in this game.
      readL.position.copy(held.position).addScaledVector(normal, 2.8);
      readL.position.y -= 0.3;
      // Only once the face has actually come round. Lit from the first frame
      // it put a warm pool on the deck's back and the card looked face-up
      // before it had turned.
      const shown = clamp01((turn - 0.45) / 0.45);
      // 16, not 30. At 30 the band of the face pointing most directly at the
      // lamp came out of ACES as flat white and took a whole line of the rules
      // text with it — the glare across the writing this file was rebuilt to
      // get rid of. The lamp's job is to bring a dark card up to the paper it
      // is printed on, not past it.
      readL.intensity = 16 * shown * (1 - span(t, GONE - 0.08, GONE));
    }

    /* the shadow */
    // lamp -> card -> ground, solved for the ground plane. |cos(tilt)| is how
    // much of the card still faces the lamp, and so how much of it the lamp
    // can lay on the floor.
    //
    // AT LIFE SIZE, and NOT at the size the card is drawn. This is the second
    // time this quad has had to be reined in — the first was hanging the lamp
    // higher, when a three-unit slab read as a hole in the ground — and
    // growing the card to nearly four times life made it far worse than
    // it had ever been: the shadow came out nine units across and the frozen
    // frame was a black rectangle covering the entire board with a card
    // floating over it. The card is enlarged to be READ, which is a piece of
    // stagecraft; its shadow is the part that has to stay physical.
    //
    // It also stands down as the card arrives. During the haul it is what says
    // the card is being held up under something; parked under the held card it
    // is competing with the one thing the player is meant to be looking at.
    const lx = rig.position.x + sx * LEAN, lz = rig.position.z;
    const drop = (shade.position.y - HANG) / (held.position.y - HANG);
    shade.position.x = lx + drop * (held.position.x - lx);
    shade.position.z = lz + drop * (held.position.z - lz);
    shade.material.opacity = 0.62 * easeOut(on) * up * out * (card ? 1 : 0)
      * (1 - 0.55 * easeOut(clamp01(lift)));
    shade.scale.set(drop, drop * Math.max(0.02, Math.abs(Math.cos(tilt))), 1);

    /* the examination */
    // It runs ONCE, on arrival, and is over well before the hold is. An
    // additive bar parked on the card during the beat the player is reading it
    // washes out the line it is sitting on — the examination is a thing that
    // happens TO the card, not the lighting the card is read under.
    const look = span(t, UP - 0.05, SCAN);
    bar.material.opacity = look > 0 && look < 1
      ? 0.34 * Math.min(1, look * 6) * (1 - look) ** 0.6 : 0;
    bar.position.z = (look - 0.5) * CARD_H * 1.06;

    /* the dust */
    for (const m of motes) {
      const u = m.userData;
      const e = (t - u.off) / u.dur;
      // The grit is struck once. The dust runs on a loop — `e % 1` — because
      // the beam has to have something moving in it for the whole of the hold
      // and a mote that has finished its one run is a mote that is not there.
      const k = u.kick ? e : (e <= 0 ? -1 : e % 1);
      if (k <= 0 || k >= 1) { m.material.opacity = 0; continue; }
      if (u.kick) m.position.set(top.x + u.x, u.y0 + k * u.rise - k * k * 0.55, top.z + u.z);
      else m.position.set(u.x, u.y0 + k * u.rise, u.z);
      m.scale.setScalar(u.size * (1 - k * 0.3));
      m.material.opacity = (u.kick ? 0.9 : 0.5) * Math.min(1, k * 5) * (1 - k) ** 0.9 * out;
    }

    /* the accuser */
    if (mark) {
      const call = Math.max(0, 1 - t / 0.07) ** 0.8 * Math.min(1, t / 0.01);
      mark.material.opacity = Math.min(1, 1.25 * Math.max(call, verdict * 0.35));
      mark.scale.setScalar(0.5 + (1 - call) * 0.22 + verdict * 0.2);
    }
  }, () => {
    removeEventListener('pointerdown', skip);
    removeEventListener('keydown', skip);
  });

  /* ----------------------------------------------------- cutting it short */

  // The hold is a second and three quarters and the UI is frozen for all of
  // it, which
  // is a real price to charge a player who has already read the card. So a
  // click or a key ends the look and goes straight to the verdict.
  //
  // It is done by winding the tween's own clock forward rather than by
  // branching the timeline: every quantity above is a function of `t` and
  // nothing else, so moving `t` is the one edit that cannot leave the motif in
  // a pose it has no way out of. `kit.hold` does not hand back the tween, so
  // it is taken off the tail of the animator's queue — `anim.add` pushes and
  // returns, so the one just added is the last — and checked against the span
  // it was created with before anything is done to it. If that check ever
  // fails the motif simply plays its full length, which is the old behaviour.
  //
  // Armed only while the card is actually up: a click during the haul would
  // otherwise skip the reveal for somebody who had not seen anything yet. The
  // table's own input is gated on `anim.busy`, so a click spent here cannot
  // also select a square.
  const q = kit.anim?.running;
  const tween = q && q.length ? q[q.length - 1] : null;
  const clock = tween && tween.span === SPAN ? tween : null;
  function skip() {
    if (!clock) return;
    if (clock.life <= UP * SPAN || clock.life >= READ * SPAN) return;
    clock.life = READ * SPAN;
  }
  if (clock) {
    addEventListener('pointerdown', skip);
    addEventListener('keydown', skip);
  }

  // A hard white at the moment of the verdict, IN FRONT of the card.
  //
  // It used to sit above and behind, for a good reason: a point light parked
  // on a card blows a featureless disc through the middle of the thing the
  // motif exists to show. That reason has expired. The hold now ends at READ,
  // a tenth of a second before this fires, so by the time the flash lands the
  // reading is done and the card going white IS the punctuation — the beat
  // that says a decision was taken about it. Put behind the card instead it
  // lit the stone beyond a rectangle that fills a quarter of the screen, and
  // the frame at the moment of judgement looked like the frame before it.
  //
  // Two and a bit units out along the face's own normal, so it is the card
  // that flares and not the board.
  kit.after(SNAP * SPAN, () => {
    const at = readAt.clone().addScaledVector(toCam.clone().normalize(), 2.2);
    kit.light(at, 0xeef4ff, { power: 34, seconds: 0.22, reach: 5.0 });
  });
}
