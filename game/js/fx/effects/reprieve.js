// REPRIEVE — the grey is lifted off a spent fighter.
//
// Shared by 2 Auroxi weavers: A008 Timeweaver ("if this fighter is in your
// Gates at the start of your Action Phase, gain an additional action") and
// A010 Fateweaver ("while this fighter is in your Gates, fighters with an
// Attachment you control may take actions while fatigued"). One sentence
// covers both: A TURN THAT HAD BEEN SPENT IS HANDED BACK.
//
// WHAT WAS HERE BEFORE, AND WHY IT IS GONE. This motif used to be called
// `echo` and it drew a weaver's shuttle crossing the card and paying out a
// ribbed band, then the identical run again at half weight — two concentric
// rings, the same line twice. That was built for M170 Twain of Twine, which
// resolves another fighter's ability a SECOND TIME, and for that card a
// literal visual echo was the right picture. Twain was then taken off this
// table on its own merits (a copied Fire Bolt should look like a Fire Bolt),
// and what was left were two cards that are not about repetition at all — so
// an abstract picture of doubling was playing for "time bought" and "a spent
// fighter given back its turn". The user's words were "really weird and
// abstract", and they were right: it was a metaphor for something that was
// not happening. Do not rebuild it. Nothing this motif plays for repeats.
//
// THE PICTURE IS THE GAME'S OWN WORD FOR SPENT, RUN BACKWARDS. A fatigued
// fighter GREYS OUT — pieces.js lerps `grey` toward `greyTarget` and dims the
// card's front material by it — and every player has already learnt that
// colour draining away means "this one has had its turn". So the whole motif
// is that vocabulary in reverse: a dead ash pall lies over the card, threads
// come in from off the square, hook its edge, and DRAW IT OFF; colour floods
// in behind the seam, the card's border takes the light, the card straightens
// up, and it stops. Nothing is repeated, nothing is abstract — one frame of
// it is a tired fighter having the weight taken off.
//
// THE PALL IS OURS, NOT THE PIECE'S. The grey could have been driven straight
// on the piece — and the piece's own colour IS driven here, at the landing —
// but a scalar on frontMat.color can only fade the WHOLE card at once, and
// the beat that carries this is the WAVEFRONT — the near half alive while the
// far half is still spent. That needs a per-pixel boundary, so the spent look
// is a cloth of our own laid over the card at full weight from frame one (no
// ramp in: the card is already grey underneath, and a ramp would flash it
// alive for a moment before greying it again), and the card's own `grey` is
// held at zero all the way through so that what the pall uncovers is a live
// card. It also means the motif still reads when it fires on a fighter that
// is NOT fatigued — a Timeweaver standing in your Gates is usually fresh —
// because the pall supplies its own "before".
//
// BORROWED AND PUT BACK. Pieces are pooled, so a card left half-coloured is a
// ghost on a later turn. `piece.animating` is held for exactly as long as we
// drive the card, which is what stops pieces.js re-lerping the grey
// underneath us and fighting us to a flicker, and the done-handler on
// kit.hold puts the colour, the height and the flag back however the motif
// ends.
//
// WHAT IS WORTH LOOKING AT, all checked by eye at play scale — where a card
// is sixty pixels and this had to stop being abstract — and again at
// &fxzoom=2.5, with the same card staged unmotifed on the squares either side
// as a control:
//    10ms  the pall matches what was already there: 60 against 62 and 58
//   430ms  the threads have bitten, the card is still spent
//   744ms  the seam is halfway: 148 of luminance live against 40 covered
//  1054ms  the landing, 147 — bright, and the art still readable
//  1500ms  the card left alive beside its grey neighbours, nothing lingering
// Past the span, pieces.js takes the card back and eases it to fatigued again
// over about half a second, which is the truth of the board: the fighter was
// given this turn, not un-spent.
//
// Preview:  node tools/shot.js --wait 10000 --settle 800 \
//   --url "game/?quick=1&seed=5&t=744" \
//   --eval tools/fxdemo/reprieve.js --out /tmp/rp.png

import { THREE, CARD_W, CARD_H, FACTION, easeOut } from '../kit.js';

/* ---------------------------------------------------------------- colour */

// The light that gives the turn back. Held well down in green and blue: ACES
// pulls about a third of the green into red and takes anything near white
// straight to white, and a white flare on a torchlit table reads as a UI
// element rather than as warmth coming back into a card.
const WARM = new THREE.Color(0xff9a34);
// The cloth. Dark, but NOT black: the pall is what makes the card look spent,
// and pieces.js's own fatigue dim leaves a card at 0.38 of normal with its art
// still perfectly readable. At full weight and near black this covered the art
// completely and the square read as an empty hole in the board — which is a
// worse lie than no effect at all. What it has to be is a FILM: mostly a
// darkening (see PALL_A) with just enough body left in the ash that the weave
// is a surface and not a dimmer switch.
const ASH = new THREE.Color(0x2b2620);
// How much of the card the cloth hides, once it has settled.
//
// A FILM'S ALPHA IS NOT A MULTIPLY ON THE CARD, and working as though it were
// cost an afternoon. three tone-maps and sRGB-encodes in each material's own
// fragment shader, so alpha blending happens in OUTPUT space, not in linear:
// a 0.72 film over a card does not leave 0.28 of its radiance, it leaves 0.28
// of its ENCODED value, which is a far deeper cut. Measured on the table: the
// card came out at 39 of luminance where an ordinary fatigued one sits at 62.
// Predict a film's result with (1-a)*card + a*film in 0..255, never in linear.
//
// 0.72 is kept because the contrast across the seam is the whole motif — it
// makes the live side better than three to one against the covered side — and
// the opening frame is squared up by PALL_SET below instead.
const PALL_A = 0.72;
// The cloth SETTLES rather than appearing at full weight. At 0.72 from frame
// one the card dropped from 62 to 39 the instant the motif started, which is
// a visible flinch before anything has happened; starting at 0.70 of that
// lands the first frame on 62 — exactly what was already on the table — and
// the cloth then takes hold over a sixth of a second, before the threads
// bite. Worse-before-better, and it makes the lift bigger.
const PALL_SET = 0.10;
// How far past normal the card is driven while the grey is on it. Two jobs
// in one number, and the second is the reason it is this exact size:
//   - the contrast at the seam is bought on the LIVE side, because the covered
//     side cannot be darkened any further without lying about what spent looks
//     like. Brightening is the one thing a multiply on frontMat.color CAN do,
//     since this goes above 1 rather than below it.
//   - and it makes the first frame seamless. A card at 1.0 under a 0.72 pall
//     comes out at 0.28 of normal, which is DARKER than the 0.38 pieces.js was
//     already showing, so the motif opened with the card dropping a stop — a
//     visible flinch before anything had happened. 1.36 times 0.28 is 0.38 on
//     the nose: the pall arrives showing exactly what was there before it.
// It decays to exactly 1 by SETTLE. A card left permanently hotter than its
// neighbours is a bug, not a payoff.
const LIVE = 0.36;
// ...but the underside of the lifted lip catches the seam, or the peel is a
// grey rectangle shrinking rather than cloth coming off something lit.
const LIP = new THREE.Color(0x7a4a1e);

/* --------------------------------------------------------------- heights */

// The flagstone face is 0.080 and a card's slab runs 0.185 to 0.220. Every
// part of this motif lies over a CARD, so every part of it has to clear that
// slab by enough that the depth buffer can tell them apart — a centimetre is
// not enough at this camera, and the possess rebuild cut its clearance to
// 0.014 and drew its decal on the STONE AROUND the card instead of on it,
// which looks exactly like an effect that never fired. Six is the number that
// has held for every motif that got this right.
const FACE = 0.215;
const FLUSH_Y = FACE + 0.058;   // the warm wave on the card face
const PALL_Y = FACE + 0.070;    // the cloth, just over it
const EDGE_Y = FACE + 0.086;    // the border light at the payoff

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a
// material never disposes its map.
const TEXES = new Map();
function tex(key, paint, w = 256, h = 256) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

/**
 * The pall: coarse ash linen, frayed along both selvedges.
 *
 * GREYSCALE, with the colour on the vertices — the lip has to warm up where
 * the seam lights it and the body has to stay dead, and that is a per-vertex
 * job. Painted dark here AND tinted dark on the material, the cloth went to
 * solid black and stopped being cloth.
 *
 * The ribs run ALONG the peel (canvas u), because that is the direction this
 * sheet is dragged in and creases follow the pull. They are COARSE — eleven
 * over the whole card — since a card is about sixty pixels wide in play and a
 * realistic weave at that size is sub-pixel, which is to say absent, and
 * shimmers as the mesh moves under it.
 */
const pallTex = () => tex('rp-pall', (g, W, H) => {
  let s = 20260924;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  g.fillStyle = '#8c857c';
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += H / 11) {
    g.fillStyle = `rgba(255,252,246,${0.16 + rnd() * 0.2})`;
    g.fillRect(0, y, W, H / 40);
    g.fillStyle = `rgba(10,8,6,${0.2 + rnd() * 0.18})`;
    g.fillRect(0, y + H / 34, W, H / 46);
  }
  for (let x = 0; x < W; x += W / 40) {          // the warp, fainter
    g.fillStyle = `rgba(16,12,9,${0.05 + rnd() * 0.09})`;
    g.fillRect(x, 0, W / 150, H);
  }
  for (let i = 0; i < 22; i++) {                 // slubs: hand-loomed cloth is uneven
    g.fillStyle = `rgba(255,250,238,${0.05 + rnd() * 0.08})`;
    g.fillRect(rnd() * W, rnd() * H, 14 + rnd() * 50, 3 + rnd() * 6);
  }
  // Frayed selvedges, top and bottom in v, so the cloth ends in threads and
  // not in a ruled line where it overhangs the card's long edges.
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < W; x++) {
    g.fillStyle = '#000';
    g.fillRect(x, 0, 1, 1 + rnd() * 5);
    g.fillRect(x, H - (1 + rnd() * 5), 1, 6);
  }
}, 256, 128);

/**
 * The wave of colour that travels with the seam.
 *
 * u runs across the band: nothing ahead of the seam, a hard bright line AT
 * it, and a short warm wash trailing behind onto the part of the card that
 * has just come back. Without the wash the seam was a line moving over a card
 * that changed brightness all at once somewhere else, and the two did not
 * read as the same event.
 */
const flushTex = () => tex('rp-flush', (g, W, H) => {
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.50, 'rgba(255,255,255,0.05)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.30)');
  // A LINE, not a wash. The first cut spread the whole flush over half a card
  // as a soft gradient, and at play scale that is a faint haze on the art with
  // no edge anywhere in it — the one thing the eye can lock onto at sixty
  // pixels is a hard bright boundary, so the core is held to a couple of
  // screen pixels at full white and everything else is falloff behind it.
  grd.addColorStop(0.655, 'rgba(255,255,255,1)');
  grd.addColorStop(0.685, 'rgba(255,255,255,1)');
  grd.addColorStop(0.74, 'rgba(255,255,255,0.34)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // softened top and bottom so the band does not end in two hard corners at
  // the card's long edges
  const ends = g.createLinearGradient(0, 0, 0, H);
  ends.addColorStop(0.00, 'rgba(0,0,0,0)');
  ends.addColorStop(0.10, 'rgba(0,0,0,1)');
  ends.addColorStop(0.90, 'rgba(0,0,0,1)');
  ends.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = ends;
  g.fillRect(0, 0, W, H);
}, 256, 64);

/**
 * A thread, seen flat from above: a hot core with a soft falloff either side.
 *
 * It is drawn as a RIBBON and not a line because a line is one pixel and a
 * card is sixty, so a thread of a believable thickness would not exist on
 * screen at all. The ribbon is wide enough to survive (three pixels or so)
 * and the texture puts the actual thread down the middle of it.
 */
const threadTex = () => tex('rp-thread', (g, W, H) => {
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.34, 'rgba(255,255,255,0.14)');
  grd.addColorStop(0.47, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.50, 'rgba(255,255,255,1)');
  grd.addColorStop(0.53, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.66, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 16, 64);

/** A soft blob, for the motes lifting off the seam. */
const blobTex = () => tex('rp-blob', (g, W, H) => {
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0.00, 'rgba(255,255,255,1)');
  grd.addColorStop(0.20, 'rgba(255,255,255,0.48)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.11)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 64, 64);

/**
 * The card's own border, for the moment the pall comes off.
 *
 * Three strokes, wide and faint down to narrow and hot — one stroke of one
 * width is a drawn rectangle, and light on an edge has a falloff either side
 * of it. It sits just inside the card's outline so it reads as the card
 * lighting up rather than as a halo the card is standing in the middle of.
 */
const edgeTex = () => tex('rp-edge', (g, W, H) => {
  const pass = (inset, width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    g.roundRect(inset, inset, W - inset * 2, H - inset * 2, 14);
    g.stroke();
  };
  pass(W * 0.235, W * 0.055, 0.16, W * 0.020);
  pass(W * 0.235, W * 0.022, 0.44, W * 0.007);
  pass(W * 0.235, W * 0.008, 1.0, W * 0.002);
  g.filter = 'none';
}, 256, 256);

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
const SPAN = 1.55;
const REACH = 0.05;      // the threads run in
const TAUT = 0.26;       // they bite, and the lip comes up
const PEEL0 = 0.28;      // the pall starts to come off
const PEEL1 = 0.68;      // and is clear of the far edge
const SETTLE = 0.94;     // the card is back down and nothing is left

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const span = (t, a, b) => clamp01((t - a) / (b - a));

/** A flat quad lying over the card. */
function decal(map, w, h, extra = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, ...extra,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function reprieve(kit, at, faction) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION[faction] || FACTION.Auroxi;
  const piece = kit.piece(at);

  const HW = CARD_W / 2, HH = CARD_H / 2;
  // The peel runs ALONG X, which is the free direction at this camera: a
  // world unit of width is about twice the screen distance a world unit of
  // depth is, so a wavefront crossing the card in x has twice the travel to
  // be seen in. Across z the whole sweep would have been a dozen pixels.
  const g = new THREE.Group();

  /* -------------------------------------------------------------- the pall */

  // A grid, not a quad: the part of the sheet behind the seam is lifted and
  // curled every frame, and a curl needs vertices to curl.
  const NX = 46, NZ = 10;
  const pgeo = new THREE.BufferGeometry();
  const N = NX * NZ;
  const ppos = new Float32Array(N * 3);
  const puv = new Float32Array(N * 2);
  // Four components: the alpha is what makes the lifted lip dissolve, and
  // that is per-vertex because it depends on how far behind the seam each
  // vertex is. entrance.js writes vertex alpha the same way.
  const pcol = new Float32Array(N * 4);
  // THE CLOTH OVERHANGS THE CARD, by a few centimetres on every side. Its
  // selvedges are frayed in the texture, and cut exactly to the card's
  // footprint that fray ate a couple of pixels off the top and bottom edges —
  // so a bright rim of live card showed along both long edges from the first
  // frame, which at this size reads as the card already glowing. Let the fray
  // fall on the flagstones instead.
  const OVER = 0.05;
  const rx = [], rz = [];
  for (let i = 0; i < NX; i++) rx.push(-HW - OVER + (i / (NX - 1)) * (CARD_W + OVER * 2));
  for (let j = 0; j < NZ; j++) rz.push(-HH - OVER + (j / (NZ - 1)) * (CARD_H + OVER * 2));
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const k = i * NZ + j;
      puv[k * 2 + 0] = i / (NX - 1);
      puv[k * 2 + 1] = j / (NZ - 1);
    }
  }
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  pgeo.setAttribute('uv', new THREE.BufferAttribute(puv, 2));
  pgeo.setAttribute('color', new THREE.BufferAttribute(pcol, 4));
  const pidx = [];
  for (let i = 0; i < NX - 1; i++) {
    for (let j = 0; j < NZ - 1; j++) {
      const a = i * NZ + j, b = a + NZ;
      pidx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  pgeo.setIndex(pidx);
  const pall = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({
    map: pallTex(), vertexColors: true, transparent: true,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  pall.frustumCulled = false;
  pall.renderOrder = 6;
  pall.position.set(p.x, 0, p.z);
  g.add(pall);

  // A ragged fringe, so the sheet dissolves along a torn line rather than a
  // ruled one. Fixed per row and not per frame: reseeded every tick it
  // boiled, and a boiling edge reads as noise, not as cloth.
  const fray = [];
  for (let j = 0; j < NZ; j++) {
    fray.push(0.78 + 0.42 * ((Math.abs(Math.sin(j * 12.9898) * 43758.5)) % 1));
  }

  /* ------------------------------------------------------------ the threads */

  // Three of them, coming in low from off the square on the side the peel
  // starts. They are what says the gift came from SOMEWHERE — both cards work
  // while the weaver stands in your Gates, and a pall that lifted off by
  // itself read as the card shrugging rather than as something being done
  // for it.
  //
  // They are ADDITIVE, so the span that crosses the part of the card already
  // uncovered all but disappears into it. That is accepted rather than fixed:
  // the geometry of a pull guarantees the threads cross the side they have
  // already bared, and the stretch that matters — the run in over the dark
  // stone, pointing at this square and no other — is exactly the stretch that
  // reads. A thread of light being taken up by a card coming back to life is
  // not the wrong picture either.
  const TSEG = 26;
  const threads = [];
  for (let n = 0; n < 3; n++) {
    const off = (n - 1) * 0.52;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TSEG * 2 * 3), 3));
    const uv = new Float32Array(TSEG * 2 * 2);
    for (let i = 0; i < TSEG; i++) {
      uv[i * 4 + 0] = i / (TSEG - 1); uv[i * 4 + 1] = 0;
      uv[i * 4 + 2] = i / (TSEG - 1); uv[i * 4 + 3] = 1;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < TSEG - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: threadTex(), color: WARM, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 9;
    g.add(mesh);
    threads.push({
      mesh, geo,
      // DIES IN THE JOINT BETWEEN THE SQUARES. Squares are 2.62 apart and a
      // card is 1.74 wide, so the neighbour's card starts 1.75 out from this
      // one's middle — at 1.26 card widths the threads were laid across the
      // next fighter's art, and a motif about ONE card looked like something
      // happening to the row. 0.92 still clears our own edge by three
      // quarters of a unit, which is plenty of approach.
      from: new THREE.Vector3(p.x - CARD_W * 0.92, FACE + 0.02, p.z + off * 1.5),
      grip: off,
    });
  }

  /* ------------------------------------------------------------- the payoff */

  const flush = decal(flushTex(), CARD_W * 0.62, CARD_H,
    { blending: THREE.AdditiveBlending, color: WARM });
  flush.position.y = FLUSH_Y;
  flush.renderOrder = 5;

  const edge = decal(edgeTex(), CARD_W * 1.70, CARD_H * 1.70,
    { blending: THREE.AdditiveBlending, color: look.spark });
  edge.position.set(p.x, EDGE_Y, p.z);
  edge.renderOrder = 7;

  g.add(flush, edge);

  // The tiredness going up off the seam. Warm, not grey: grey motes on a dark
  // table are nothing at all, and what is leaving is being turned back into
  // the card's own light anyway.
  const motes = [];
  for (let n = 0; n < 9; n++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTex(), color: WARM, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.scale.setScalar(0.2);
    g.add(s);
    motes.push({
      s,
      u: 0.08 + (n / 9) * 0.86,                       // where on the sweep it is let go
      z: (Math.sin(n * 7.3) * 0.42),
      drift: 0.1 + Math.sin(n * 3.1) * 0.08,
      rise: 0.5 + Math.abs(Math.cos(n * 2.7)) * 0.4,
    });
  }

  // A LAMP THAT TRAVELS WITH THE SEAM. Everything above is paint on a card,
  // and paint on a card sixty pixels wide is a texture change nobody notices
  // across a whole board. A real light does something no decal can: it puts
  // the event on the FLAGSTONES around the square as well, so the eye is
  // pulled to the right place before it has worked out what is happening
  // there. It is small and low-powered for the same reason the landing lamp
  // is — two flashes on a card this size blew the art out to white the first
  // time this arena was lit.
  const lamp = new THREE.PointLight(look.spark, 0, 3.0, 2);
  lamp.position.set(p.x, FACE + 0.55, p.z);
  g.add(lamp);

  /* --------------------------------------------------------------- the card */

  // What we borrow, and what has to go back exactly as it was. pieces.js owns
  // `grey` and re-lerps it toward `greyTarget` every frame, so the only safe
  // way to hold a card lit is to take `animating` for the duration — that is
  // the flag update() checks before it touches the transform or the colour —
  // and hand it back when we are done.
  const baseY = piece ? piece.group.position.y : 0;
  const hadAnim = piece ? !!piece.animating : false;
  if (piece) piece.animating = true;

  const lipCol = new THREE.Color();
  const tip = new THREE.Vector3();
  // NEARLY LINEAR, with the ends softened. easeOut was the first choice and it
  // spent four fifths of the peel in the first fifth of the time: by the frame
  // the eye had found the wavefront it had already crossed the card, and what
  // was left was a seam creeping the last few millimetres for half a second.
  // A pull breaks its grip, travels, and whips off — and the speed in the
  // middle is the speed the whole motif is read at, so it is held steady.
  const seamAt = (t) => {
    const k = span(t, PEEL0, PEEL1);
    return -HW - 0.02 + (CARD_W + 0.04) * (0.3 * k + 0.7 * (k * k * (3 - 2 * k)));
  };

  kit.hold(g, SPAN, (t) => {
    const k = span(t, PEEL0, PEEL1);
    const seam = seamAt(t);
    // The lip does not wait for the peel to start: the threads bite at TAUT
    // and the near edge comes up off the card before it begins to travel, or
    // the sheet slid sideways out of nowhere with no one holding it.
    const bite = span(t, TAUT - 0.1, TAUT + 0.06);
    const R = 0.055 + 0.075 * bite;                 // the roll thickens as it takes cloth
    const FR = 0.30 + 0.16 * bite;                  // how far back the lip dissolves
    const gone = span(t, PEEL1 + 0.04, PEEL1 + 0.16);
    const weight = PALL_A * (0.70 + 0.30 * Math.min(1, t / PALL_SET));

    /* ----------------------------------------------------------- the cloth */

    for (let i = 0; i < NX; i++) {
      const d = seam - rx[i];
      for (let j = 0; j < NZ; j++) {
        const kk = i * NZ + j;
        let x = rx[i], y = PALL_Y, z = rz[j];
        let a = 1;
        // The cloth is LIFTED where it is being taken, on both sides of the
        // seam. Without this the threads bit onto a sheet still lying dead
        // flat and then dragged it sideways — nothing was ever picked up, and
        // for the whole of the pull before the peel starts there was no lip
        // for them to be holding at all.
        const hump = bite * 0.085 * Math.max(0, 1 - Math.abs(d) / 0.3);
        if (d > 0) {
          // The sheet leaves the card tangentially at the seam and wraps a
          // roll sitting directly above it. P(0) is the seam itself and
          // increasing theta walks BACK along the cloth in -x, which is the
          // only arrangement in which the lifted part stays behind the
          // wavefront instead of running ahead of it.
          const th = Math.min(d / R, 2.4);
          const extra = Math.max(0, d - th * R);
          x = seam - R * Math.sin(th) - extra * Math.cos(th);
          y = PALL_Y + R - R * Math.cos(th) + extra * Math.sin(th);
          // it narrows a little as it curls, the way a sheet gathers
          z = rz[j] * (1 - 0.07 * th) + Math.sin(th * 3.1 + j) * 0.012;
          a = (1 - clamp01(d / (FR * fray[j]))) ** 1.25;
        }
        y += hump;
        ppos[kk * 3 + 0] = x;
        ppos[kk * 3 + 1] = y;
        ppos[kk * 3 + 2] = z;
        // The underside of the lip is lit by the seam it is being pulled off;
        // everything more than a few centimetres from it is dead ash.
        lipCol.copy(ASH).lerp(LIP, Math.exp(-Math.abs(d) / 0.085) * 0.9);
        pcol[kk * 4 + 0] = lipCol.r;
        pcol[kk * 4 + 1] = lipCol.g;
        pcol[kk * 4 + 2] = lipCol.b;
        pcol[kk * 4 + 3] = a * weight * (1 - gone);
      }
    }
    pgeo.attributes.position.needsUpdate = true;
    pgeo.attributes.color.needsUpdate = true;

    /* ---------------------------------------------------------- the threads */

    // Run in, bite, then hold the lip.
    const grow = easeOut(span(t, REACH, TAUT));
    const fadeT = 1 - span(t, PEEL1 - 0.06, PEEL1 + 0.12);
    for (const th of threads) {
      // The far end is the APEX of the curl, a quarter turn back from the
      // seam — but only once there IS a curl. Pinned to the apex from the
      // first frame the threads ended in mid-air a sixth of a unit off the
      // card's edge, holding a roll that had not formed yet, so the offset is
      // eased in with the peel.
      const kIn = Math.min(1, k * 4);
      tip.set(p.x + seam - R * kIn,
        PALL_Y + 0.03 + 0.085 * bite + R * kIn,
        p.z + th.grip * 0.83);
      const pos = th.geo.attributes.position.array;
      // Slack while it is running in, straight once it has bitten. A thread
      // that arrived already taut read as a beam being fired at the card.
      const sag = (1 - grow) * 0.13 + (1 - Math.min(1, bite)) * 0.05;
      for (let i = 0; i < TSEG; i++) {
        const u = (i / (TSEG - 1)) * grow;
        const x = th.from.x + (tip.x - th.from.x) * u;
        const y = th.from.y + (tip.y - th.from.y) * u - Math.sin(Math.PI * u) * sag;
        const z = th.from.z + (tip.z - th.from.z) * u;
        // A flat ribbon, spread across the run. The camera looks down at this
        // table, so a strip lying level is seen very nearly face on — and a
        // strip stood on edge would be the one pixel we were avoiding.
        const w = 0.052 * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.2)));
        pos[i * 6 + 0] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z - w;
        pos[i * 6 + 3] = x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z + w;
      }
      th.geo.attributes.position.needsUpdate = true;
      th.mesh.material.opacity = 0.9 * Math.min(1, grow * 3) * fadeT;
    }

    /* ------------------------------------------------------------ the flush */

    // The band rides with the seam and is switched off once the seam has left
    // the card, so no warm light is ever painted on the bare flagstones.
    const on = clamp01((HW + 0.16 - Math.abs(seam)) / 0.2);
    // The map's hot core sits at 0.67 of the band, so the band is offset by
    // that much of its own width to put the core exactly on the seam.
    flush.position.set(p.x + seam - CARD_W * 0.62 * 0.17, FLUSH_Y, p.z);
    // OFF BEFORE THE LANDING, not with it. Held to PEEL1 the seam was still
    // burning against the card's right edge at the exact frame the border
    // lights, and the payoff came out lopsided — a lamp standing beside the
    // card rather than the card itself coming back.
    flush.material.opacity = 0.62 * on * Math.min(1, k * 8)
      * (1 - span(t, PEEL1 - 0.07, PEEL1 + 0.01));

    /* ------------------------------------------------------------ the payoff */

    // ONE beat, at the moment the last of the grey leaves the far edge. The
    // border takes the light, the card comes up off the stone and settles,
    // and that is the end of it — there is no second event, because there is
    // no second event in the cards.
    const land = Math.max(0, 1 - Math.abs(t - PEEL1) / 0.2) ** 1.5;
    edge.material.opacity = land * 0.9;
    edge.scale.setScalar(1 + 0.045 * (1 - land));

    // A fighter that has been given its turn back STRAIGHTENS UP. Five
    // centimetres is about a pixel and a half of height at this camera, so it
    // is not the signal — the colour is — but it is what stops the card from
    // sitting there inertly through its own payoff.
    const rise = Math.sin(Math.PI * span(t, PEEL1 - 0.16, SETTLE)) ** 0.8;
    if (piece) {
      piece.group.position.y = baseY + 0.055 * rise;
      // The card is ALIVE for the whole motif and the pall is what makes it
      // look spent. What is driven here is how far PAST alive it goes: up as
      // the seam starts to travel, so the uncovered side is hotter than the
      // covered side by more than the cloth alone could manage, and back to
      // exactly 1 by SETTLE so the card is left the way the board expects it.
      piece.grey = 0;
      // Held full until the grey is off, then eased away. Adding the landing
      // flash on top of this put the card at 1.44 of normal for a few frames
      // and the art blew out — the border light and the lamp are what carry
      // the landing, and they do it without touching the picture.
      // It starts coming OFF before the landing, not after. Held full through
      // the landing the card measured 182 of luminance with the two lamps on
      // top of it and the art washed out to white in the middle — a card you
      // cannot read is a worse answer than no effect at all.
      const over = 1 - span(t, PEEL1 - 0.14, SETTLE);
      piece.frontMat.color.setScalar(1 + LIVE * over);
    }

    // The travelling light rides just behind the seam while it is on the card
    // and swells once at the landing. Clamped to the card's own span so it is
    // never a lamp sitting out on the bare flagstones with nothing to light.
    // ...and it walks back to the middle of the card as it lands, for the same
    // reason: the last thing this motif says is "this card", not "this edge".
    const lampX = Math.max(-HW, Math.min(HW, seam - 0.12)) * (1 - land);
    lamp.position.set(p.x + lampX, FACE + 0.55, p.z);
    // HIGH AND WEAK. A point light with quadratic falloff a third of a unit
    // over a card is a blowtorch — at 2.1 and 0.36 the landing frame measured
    // 182 of luminance and the art went white in the middle. Lifted to 0.55
    // and more than halved, it still puts the event on the flagstones, which
    // is the job, without bleaching the picture it is meant to be restoring.
    lamp.intensity = 1.0 * on * Math.min(1, k * 6) * (1 - span(t, PEEL1, PEEL1 + 0.08))
      + 0.6 * land;

    for (const m of motes) {
      const e = span(t, PEEL0 + (PEEL1 - PEEL0) * m.u, PEEL1 + 0.26);
      if (e <= 0 || e >= 1) { m.s.material.opacity = 0; continue; }
      const sx = -HW - 0.06 + (CARD_W + 0.12) * m.u;
      m.s.position.set(
        p.x + sx - m.drift * e, PALL_Y + 0.05 + m.rise * e, p.z + m.z + e * 0.05,
      );
      m.s.material.opacity = 0.5 * Math.sin(Math.PI * e ** 0.55);
      m.s.scale.setScalar(0.16 + 0.13 * e);
    }
  }, () => {
    // BORROWED, PUT BACK. `grey` goes to zero rather than to whatever it was:
    // the card has visibly just come back, and pieces.js lerps it toward
    // `greyTarget` at dt*7 from here, so a fighter that is still fatigued in
    // the rules eases back down over about half a second instead of snapping
    // grey in one frame the instant we let go.
    if (!piece) return;
    piece.frontMat.color.setScalar(1);
    piece.grey = 0;
    piece.group.position.y = baseY;
    piece.animating = hadAnim;
  });

  /* ------------------------------------------------------------- the lights */

  // One lamp, at the landing, and it is SMALL: a full flash on a card this
  // size blew the art out to white, and a card you cannot read is a worse
  // answer than no effect at all. High, because down at the face the falloff
  // put a hot spot in the middle of the picture.
  kit.after(PEEL1 * SPAN, () => {
    kit.light(new THREE.Vector3(p.x, FACE + 0.9, p.z), look.spark,
      { power: 2.2, seconds: 0.38, reach: 3.6 });
  });
}

/**
 * Nothing this motif touches leaves the board — both cards are constant or
 * start-of-turn abilities on fighters that stay where they are — so there is
 * no kill wait to declare and no exit to own.
 */
export const timing = { kill: 0 };
