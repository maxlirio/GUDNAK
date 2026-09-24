// ARCANE BLAST — cards torn out of your hand, spent, and brought down on one
// fighter.
//
// Shared by 1 card: C070. "Discard X cards from your hand, where X is 1
// greater than target enemy fighter's power. Then, destroy that fighter."
//
// The whole motif is COST FIRST, THEN THE KILL, in that order and clearly
// separated in time, because that is what the card says and it is the most
// expensive thing in the game:
//
//   0.00-0.15  THE CARDS YOU ACTUALLY DISCARDED are dealt into an arc over
//              the fighter, which is marked from the first frame so you know
//              who is paying
//   0.15-0.34  they all hang together — this is the only beat in which the
//              PRICE is countable, and it exists on purpose
//   0.34-0.55  they are spent ONE AT A TIME, each with its own flash
//   0.34-0.85  what is left of each streams inward and up to one gathering
//              point, which grows a step as every stream arrives
//   0.89-0.98  the gather compresses to a point and lets go
//   0.98       five crystal lances grow out of it and drive into the card
//   0.98-2.6   the square is left with crystal standing in it, cracked,
//              scorched and cooling — and the card itself is in nine pieces
//              on its way to the discard pile (see exit.destroy at the end)
//
// The Shardsworn palette is shardfire's — reddish-pink crystal, green held
// near 0.1 so ACES tone-mapping cannot push a stack of additive sprites to
// white — but nothing of its SHAPE. Shard fire blooms outward from a death;
// this converges inward and comes straight down.
//
// THE CARDS ARE THE REAL ONES. They used to be four invented plates — a pink
// rounded rectangle with a diamond crest and two bars of pretend rules text —
// drawn four times whatever the fighter's power was, because the rules had no
// way of saying which cards had been discarded or how many. Both halves of
// that are fixed: `ops.noteCards` names them and `fx.js` passes the whole
// event through as a fourth argument, so `ev.cards` is the exact list, in the
// order the rules touched them, and `ev.cards.length` is the real price —
// two for a I, three for a II, four for a III.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=980&kill=1" \
//             --eval tools/fxdemo/arcane.js --out /tmp/a.png \
//             --wait 4200 --settle 450
//           ...and &n=2 for a two-card blast, which is a different picture.

import { THREE, CARD_W, CARD_H } from '../kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut3 = (t) => 1 - (1 - t) ** 3;
const easeIn3 = (t) => t * t * t;

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold() disposes materials and a
// material never disposes its map, so building these per cast would leak.
const TEXES = new Map();
function tex(key, paint, size = 256) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

/**
 * There is no card texture in this file any more.
 *
 * What used to be here was `cardTex()`: a pink rounded rectangle with a
 * diamond crest and two bars standing in for rules text, painted four times.
 * The user's rule is that an animation with cards in it uses the cards — so
 * the fan is now built from `kit.card(id)`, which is the printed face on the
 * same slab the table's own pieces are. `roundRect` went with it; nothing
 * else in this file drew a rounded corner.
 */

/** Radial cracks — the card breaking, and the stone under the strike. */
const crackTex = () => tex('crack', (g, S) => {
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,1)';
  // Even spokes of even length came out a snowflake, so the angles jitter by
  // nearly half the spacing and the lengths vary by a factor of two.
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2 + rnd(-0.3, 0.3);
    // Widths in FRACTIONS OF THE TEXTURE, not pixels. At a flat 3.6px on a
    // 256 map, drawn onto a card sixty pixels across, every crack came out
    // under one screen pixel and the square looked untouched in every shot
    // after the strike — I went looking for the mesh twice before measuring.
    let a = a0, x = S / 2, y = S / 2, w = S * (0.048 + Math.random() * 0.030);
    const steps = 3 + ((Math.random() * 4) | 0);
    for (let k = 0; k < steps; k++) {
      const len = S * (0.06 + Math.random() * 0.075);
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      if (k === 1 && Math.random() < 0.7) {
        const b = a + (Math.random() < 0.5 ? -0.85 : 0.85);
        g.lineWidth = w * 0.6;
        g.beginPath(); g.moveTo(nx, ny);
        g.lineTo(nx + Math.cos(b) * S * 0.11, ny + Math.sin(b) * S * 0.11);
        g.stroke();
      }
      x = nx; y = ny; a = a0 + (Math.random() - 0.5) * 0.7; w *= 0.74;
    }
  }
});

/** Soft round light — the gather, the motes, the impact flash. */
const glowTex = () => tex('glow', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.13, 'rgba(255,255,255,0.72)');
  grd.addColorStop(0.36, 'rgba(255,255,255,0.20)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
}, 128);

/** A hard dot with a halo — the motes streaming in, and the embers after. */
const moteTex = () => tex('mote', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.17, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.38, 'rgba(255,255,255,0.20)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
}, 128);

/**
 * The column of light. Bright down its middle, gone at the sides, faded out at
 * the top where it leaves the gather.
 *
 * This was an additive CYLINDER first and it was wrong in a way worth writing
 * down: an additive tube is brightest where you see through the most of it,
 * which is at its SILHOUETTE, so it came out as a flat pale slab with two
 * bright rims — a pane of glass standing on the board, not a beam. Light is
 * brightest down its axis. The sprites that use this are anchored at their
 * base (center.y = 0) so the column always stands upright on the card
 * whichever side of the table you are sitting on.
 */
const beamTex = () => tex('beam', (g, S) => {
  const hor = g.createLinearGradient(0, 0, S, 0);
  // The bright band is most of the width, not a hairline down the middle.
  // With the core between 0.44 and 0.56 the column measured nine pixels
  // across on a 1.5-unit sprite and the strike read as a laser pointer.
  hor.addColorStop(0, 'rgba(255,255,255,0)');
  hor.addColorStop(0.14, 'rgba(255,255,255,0.13)');
  hor.addColorStop(0.28, 'rgba(255,255,255,0.5)');
  hor.addColorStop(0.40, 'rgba(255,255,255,0.93)');
  hor.addColorStop(0.5, 'rgba(255,255,255,1)');
  hor.addColorStop(0.60, 'rgba(255,255,255,0.93)');
  hor.addColorStop(0.72, 'rgba(255,255,255,0.5)');
  hor.addColorStop(0.86, 'rgba(255,255,255,0.13)');
  hor.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hor;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-in';
  const ver = g.createLinearGradient(0, 0, 0, S);
  ver.addColorStop(0, 'rgba(0,0,0,0)');          // the top, where it fades out
  ver.addColorStop(0.16, 'rgba(0,0,0,0.85)');
  ver.addColorStop(0.55, 'rgba(0,0,0,1)');
  ver.addColorStop(1, 'rgba(0,0,0,1)');          // the bottom, on the card
  g.fillStyle = ver;
  g.fillRect(0, 0, S, S);
});

/** The mark on the fighter: it is told what is coming before it arrives. */
const runeTex = () => tex('rune', (g, S) => {
  const c = S / 2;
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = S * 0.018;
  g.beginPath(); g.arc(c, c, S * 0.40, 0, Math.PI * 2); g.stroke();
  g.lineWidth = S * 0.010;
  g.beginPath(); g.arc(c, c, S * 0.455, 0, Math.PI * 2); g.stroke();
  // ticks round the rim
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r0 = S * (i % 4 === 0 ? 0.30 : 0.355), r1 = S * 0.40;
    g.lineWidth = S * (i % 4 === 0 ? 0.020 : 0.010);
    g.beginPath();
    g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    g.stroke();
  }
  // the diamond in the middle, matching the crest on the spent cards
  g.lineWidth = S * 0.016;
  g.beginPath();
  g.moveTo(c, c - S * 0.19); g.lineTo(c + S * 0.14, c);
  g.lineTo(c, c + S * 0.19); g.lineTo(c - S * 0.14, c);
  g.closePath(); g.stroke();
});

/** The burn left on the stone. Drawn as a mask; the mesh that uses it is DARK. */
const scorchTex = () => tex('scorch', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.48);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.40, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.74, 'rgba(255,255,255,0.36)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.random() * 0.2;
    const r = S * (0.30 + Math.random() * 0.2);
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r,
      S * (0.05 + Math.random() * 0.09), 0, Math.PI * 2);
    g.fill();
  }
});

/* -------------------------------------------------------------- colour */

// Shardfire's colours, and for the same reason: green near 0.1 and blue near
// 0.3 so however deep the additive stack gets the core clips to hot pink
// instead of going white and sugary.
//
// There is deliberately NO near-white in this list. The first cut lit the
// beam's core at 0xffd0e2 and the streams at emissiveIntensity 2.4, and
// photographed mid-gather the four streams were white strokes and the column
// was a white bar with a pink fringe — the one thing this motif must not do,
// because the colour IS the faction. Everything hot here is still 1.0/0.2/0.4.
const HOT = 0xff2f68;
const PALE = 0xff5a92;
const DEEP = 0x8d1740;

/* ------------------------------------------------------------- timing */

// The four cards have to be UP TOGETHER for a beat before any of them goes,
// or the count is never legible: dealt every 90ms and burning from 260ms, the
// fourth card arrived after the first had already gone and there was no frame
// in the whole motif with four cards in it. Dealt in 150ms and held to 340,
// there are nearly two hundred milliseconds of a full hand.
const T_FAN = 0.05;          // a card arrives every T_FAN
const T_BURN = 0.34;         // the first one is spent here
const T_STEP = 0.07;         // ...and the rest follow one at a time
const T_DRAW = 0.30;         // how long its remains take to reach the gather
// The last card must be SPENT AND ARRIVED with a clear beat to spare. Tuned
// the other way round first — burn 0.30, step 0.085, draw 0.34 — the fourth
// stream was still crossing the board at the moment of impact, so a stray
// pink whip hung over the far row through the entire strike.
const T_HIT = 0.98;          // the lances land
const SPAN = 2.6;

// Measured, not guessed. The flagstone face is at 0.080 and the card face at
// about 0.21: the first cut of this file put the scorch and the cracks at
// 0.05, which is INSIDE the stone, and neither was visible in any frame of
// any shot. Module scope because exit.destroy needs it too — the card's
// pieces have to stop ON the flagstone and not sink through it.
const FLOOR = 0.095;

/**
 * `ev` is the whole note, and the only field this motif reads out of it is
 * `ev.cards` — the ids of the cards the rules actually discarded.
 *
 * It can be absent: the effects bench fires the motif bare, and an old saved
 * note has no list on it. There is then no honest way to show a hand, so the
 * cost beat plays with its flashes, streams and motes and NOTHING in the fan
 * — which is the one thing worse than four invented plates only if you have
 * never seen the four invented plates. The rules name them in every real cast.
 */
export function arcane(kit, at, faction, ev) {
  const p = kit.at(at);
  if (!p) return;

  const base = new THREE.Vector3(p.x, p.y, p.z);
  const phase = Math.random() * Math.PI * 2;

  // THE PRICE, in the cards that actually paid it.
  //
  // `ev.cards` is what the rules discarded, in order, so the COUNT is real as
  // well as the faces — this used to deal four plates at a III, at a II and
  // at a I alike, which is a picture of the rule rather than of what happened
  // at the table. Read here, before the geometry, because how many there are
  // decides how high the fan hangs and how wide it opens.
  const ids = Array.isArray(ev?.cards) ? ev.cards.filter(Boolean) : [];
  // Four when nothing was named. Every beat below is built round a fan and an
  // empty one has no shape at all — but a slot with no id gets NO CARD DRAWN
  // in it (see kit.card returning null): only its flash and its stream play.
  const CARDS = Math.max(1, ids.length || 4);

  // Where the spent energy collects, and where the fan of cards hangs over it.
  // Both are HIGH. This camera looks down about 52 degrees, so a vertical
  // world unit is only 0.62 of a horizontal one on screen; a gather point at
  // head height was 20 pixels above the card and the strike had nowhere to
  // fall from.
  // The gather is HIGH and the spent cards are LOW AND WIDE, and that is the
  // other way round from how this was first built.
  //
  // The fan used to hang at +4.25 above the target. On the centre square it
  // looked well; photographed on square 7 — the far row — it was off the top
  // of the window behind the title, because this camera turns a world unit of
  // HEIGHT into 26 screen pixels and a world unit of depth into another 26,
  // so a far-row target starts sixty pixels higher before the motif has
  // added anything. Three units of fan on top of that is off the board.
  //
  // Width costs nothing: the nine squares are 300 pixels across in a 1280
  // window, so there is room either side of any target and none above a far
  // one. So the cost is spread sideways and the KILL keeps the height.
  const GY = base.y + 3.35;
  const gather = new THREE.Vector3(base.x, GY, base.z);
  // ...and the fan hangs HIGHER when there is less of it. A two-card blast
  // is two cards wide, and at the four-card height they sat directly over the
  // far row and photographed as two cards lying on the board. The height that
  // is unaffordable for four is free for two.
  const FANY = base.y + 2.55 + Math.max(0, 4 - CARDS) * 0.16;

  const group = new THREE.Group();
  const tint = new THREE.Color();
  const vec = new THREE.Vector3();
  const vec2 = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);

  /* --------------------------------------------------- the mark */

  // The victim is marked from the first frame. Without it the opening half
  // second is four cards burning in the sky with nothing to say who is paying
  // for what, and the sequence only becomes about this fighter at the end.
  const rune = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 2.3),
    new THREE.MeshBasicMaterial({
      map: runeTex(), color: PALE, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  rune.rotation.x = -Math.PI / 2;
  // +0.055 over the card face. Flat on the card's own height it loses the
  // depth test against the card and draws only on the stone AROUND it, which
  // looks like a hole rather than a mark.
  rune.position.set(base.x, base.y + 0.055, base.z);
  group.add(rune);

  /* --------------------------------------------------- the spent cards */

  // The cards came out of the CASTER's hand, and the caster is whoever the
  // victim is not. Cards on this table face their owner (pieces.js baseYaw),
  // so the fan faces the player who paid for it.
  const paid = kit.piece(at)?.owner === 0 ? 1 : 0;
  const yaw0 = paid === 0 ? 0 : Math.PI;

  // FULL SIZE up to four of them. A card on a square measures about eighty-
  // five pixels across in a 1280 window and that is the size a player has
  // been taught to read; the plates these replace were 1.12-1.26 units, two
  // thirds of a card, and a real painting shrunk to that is unrecognisable —
  // which is the whole thing this change exists to fix. Past four the fan has
  // to give ground or it runs off both sides of the board.
  const SIZE = CARDS <= 4 ? 1 : Math.max(0.6, 4 / CARDS);
  // Overlapping, the way a hand is actually held, and the overlap TIGHTENS
  // with the count so the span stays on the board. Two cards at four cards'
  // spacing sit almost edge to edge and read as two objects that happen to be
  // near each other rather than as a hand.
  const fanW = Math.max(0.55, Math.min(1.44, 6.0 / (CARDS + 1.2))) * SIZE;
  // The SPLAY opens as the count falls, for the same reason the height does.
  // A fixed angle per card gave a two-card fan eleven degrees between the two
  // of them, which is not a hand, it is a pair of cards someone put down
  // slightly crooked.
  const fanA = Math.min(0.46, 1.0 / CARDS);
  const cards = [];
  for (let i = 0; i < CARDS; i++) {
    const k = i - (CARDS - 1) / 2;         // -1.5 .. 1.5 at four
    // The real printed face, on the same slab the table's own pieces are.
    const mesh = kit.card(ids[i]);
    const mats = [];
    if (mesh) {
      // A card is a LIT object. It is not made emissive to be seen — an
      // emissive card-shaped rectangle comes out of ACES as a white slab, and
      // a card-shaped additive rectangle reads as a lens flare. The fan's own
      // light at the bottom of this file is what makes these readable three
      // units above a dark board; the emissive here is 0 until the card is
      // spent, and then only for the flare that spends it.
      mesh.castShadow = false;
      for (const m of mesh.material) {
        if (mats.some((e) => e.m === m)) continue;   // four edges, one material
        m.transparent = true;
        m.emissive.setHex(HOT);
        m.emissiveIntensity = 0;
        mats.push({ m, base: m.color.clone() });
      }
      mesh.rotation.y = yaw0 - k * fanA;   // fanned, the way a hand is held
      mesh.scale.setScalar(SIZE);
      mesh.visible = false;
      group.add(mesh);
    }
    cards.push({
      mesh, mats,
      // The outer cards hang LOWER, not higher. A hand is held the other way
      // up, but we are looking down on this from above and the top of the arc
      // is what decides whether the motif fits on the screen at all when the
      // target is on the far row. Curving down keeps the highest thing in the
      // cost the middle two cards.
      x: base.x + k * fanW, y: FANY - Math.abs(k) * 0.28, z: base.z + 0.3,
      born: i * T_FAN,
      burn: T_BURN + i * T_STEP,
      bob: rnd(0, 6),
    });
  }

  // The moment a card is torn out. Shrinking the sprite alone read as being
  // switched off, not spent — four cards quietly dimming in turn. A hard
  // flash on the exact frame each one goes is what makes it a COST being
  // counted out loud.
  const pops = cards.map((c) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: HOT, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    s.position.set(c.x, c.y, c.z);
    group.add(s);
    return s;
  });

  /* --------------------------------------------------- the streams */

  // One ribbon per spent card, laid HEAD FIRST (index 0 at the gather) so
  // kit.strip's taper thins the tail and not the bright end.
  const SEG = 48;
  const streams = cards.map((c) => {
    // emissive 0.95, not the 2.4 this started at: a standard material's
    // emissive goes through ACES, and 2.4 x (1, 0.18, 0.41) tone-maps to
    // white. Held under 1 it stays the colour of the shards.
    const st = kit.strip({ segments: SEG, width: 0.30, colour: HOT, emissive: 0.95 });
    st.mat.blending = THREE.AdditiveBlending;
    st.mat.depthWrite = false;
    st.mat.depthTest = false;              // the corpse is thrown through this
    st.mat.color.setHex(DEEP);             // dark body; the emissive is the glow
    st.mesh.castShadow = false;
    group.add(st.mesh);
    const from = new THREE.Vector3(c.x, c.y, c.z);
    // Bowed sideways and lifted in the middle, so four streams from a flat fan
    // do not arrive as four straight lines. The bow shrinks to nothing at both
    // ends, which is what makes them look DRAWN IN rather than fired.
    //
    // Half what it was. At +-1.0 the streams swung a full square out of their
    // way and read as whips cracking over the board rather than as four short
    // lines being pulled into one point.
    const side = vec.copy(gather).sub(from).cross(UP).normalize().clone();
    const bow = rnd(0.2, 0.42) * (Math.random() < 0.5 ? -1 : 1);
    return {
      st, from, side, bow, lift: rnd(0.1, 0.3),
      pts: Array.from({ length: SEG }, () => new THREE.Vector3()),
    };
  });

  // Stops at 0.93, not 1. Run all the way in, four ribbon heads landed on the
  // same dozen pixels as the core and the halo; six additive layers summed
  // past 1.0 in every channel and the gather photographed as a WHITE star with
  // a pink fringe. Held just short, the core is the brightest thing there and
  // it is pink.
  const curveAt = (s, u, out) => {
    out.lerpVectors(s.from, gather, u * 0.93);
    const k = Math.sin(u * Math.PI);
    out.addScaledVector(s.side, s.bow * k);
    out.y += s.lift * k;
    return out;
  };

  /* --------------------------------------------------- the motes */

  // What is actually left of a card: a handful of bright grains that fall
  // inward. The ribbon is the path, these are the substance travelling it.
  const PER = 9;
  const MOTES = CARDS * PER;
  const moGeo = new THREE.BufferGeometry();
  const moPos = new Float32Array(MOTES * 3);
  const moCol = new Float32Array(MOTES * 4);
  moGeo.setAttribute('position', new THREE.BufferAttribute(moPos, 3));
  moGeo.setAttribute('color', new THREE.BufferAttribute(moCol, 4));
  const motes = new THREE.Points(moGeo, new THREE.PointsMaterial({
    map: moteTex(), size: 0.30, sizeAttenuation: true, vertexColors: true,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  motes.frustumCulled = false;
  group.add(motes);
  const mo = [];
  for (let i = 0; i < MOTES; i++) {
    const c = (i / PER) | 0;
    mo.push({
      of: c,
      jx: rnd(-0.45, 0.45), jy: rnd(-0.4, 0.4), jz: rnd(-0.3, 0.3),
      born: cards[c].burn + rnd(0, 0.05),
      trip: T_DRAW * rnd(0.8, 1.0),
      flick: rnd(16, 34),
    });
  }

  /* --------------------------------------------------- the gather */

  // A faceted solid, not a blob: the whole faction is cut crystal, and a soft
  // ball of light in the sky could belong to any of the five.
  const coreMat = new THREE.MeshBasicMaterial({
    color: HOT, transparent: true, opacity: 0, depthWrite: false,
    depthTest: false, blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), coreMat);
  core.position.copy(gather);
  group.add(core);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color: PALE, transparent: true, opacity: 0,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  halo.position.copy(gather);
  group.add(halo);

  // splinters orbiting the gather — the cards themselves, in pieces
  const splinter = new THREE.OctahedronGeometry(0.5, 0);
  splinter.scale(0.30, 1, 0.22);
  // Modest emissive, like shard fire's blades and for the same reason: run
  // hot the splinters are one flat magenta silhouette whatever the light
  // does, which reads as cut paper. Kept low they take the gather's own light
  // and show a lit side and a dark side.
  const orbMat = new THREE.MeshStandardMaterial({
    color: DEEP, emissive: HOT, emissiveIntensity: 0.34,
    roughness: 0.3, metalness: 0.05, flatShading: true, transparent: true,
  });
  const ORB = 14;
  const orbs = new THREE.InstancedMesh(splinter, orbMat, ORB);
  orbs.frustumCulled = false;
  group.add(orbs);
  // They point OUTWARD off a sphere, not round it in a ring. Flown as an
  // orbit — tangential, all at much the same height — the gather photographed
  // as a flat pink splash with a couple of points on it, which is a bird, not
  // a crystal. Quills off a ball read as crystal from any angle, and that is
  // the one thing the gather has to say before it comes down.
  const orbit = [];
  for (let i = 0; i < ORB; i++) {
    const y = 1 - (2 * i + 1) / ORB;              // even bands up the sphere
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const a = phase + i * 2.39996;                // golden angle, so no seams
    orbit.push({
      dy: y, dr: rr, a,
      // Half this size the splinters were twelve pixels of pink lost inside
      // the core's own glare, and the gather was a glowing ball that could
      // have belonged to any of the five factions. The crystal has to be the
      // SILHOUETTE; the glow only lights it.
      // Short. At 0.9 each, ten of them made a two-unit star seventy pixels
      // across and the gather read as a pink flower opening over the board.
      // Short and many is a burr; long and few is a bloom.
      len: rnd(0.3, 0.6), arrive: T_BURN + rnd(0, 0.3),
    });
  }

  /* --------------------------------------------------- the lance */

  // The strike needs a SILHOUETTE. A column of light on its own is a lamp; a
  // hard faceted spike driving down through it is a weapon, and it is the
  // thing that makes the last beat read as a kill rather than a glow.
  //
  // FIVE of them, not one. A single lance inside a glowing column was
  // invisible — at this camera the column is 25 pixels wide and the spike sat
  // entirely inside its own glare. A splayed cluster puts hard edges OUTSIDE
  // the light, which is the only place the eye can find them.
  const LANCES = 5;
  const lanceMat = new THREE.MeshStandardMaterial({
    color: DEEP, emissive: HOT, emissiveIntensity: 0.6,
    roughness: 0.28, metalness: 0.05, flatShading: true, transparent: true,
  });
  const lances = new THREE.InstancedMesh(splinter, lanceMat, LANCES);
  lances.frustumCulled = false;
  lances.castShadow = true;
  group.add(lances);
  const lance = [];
  for (let i = 0; i < LANCES; i++) {
    const a = phase + (i / (LANCES - 1)) * Math.PI * 2;
    lance.push({
      r: i === 0 ? 0 : rnd(0.30, 0.52), a,
      // The splinter geometry is already squeezed to 0.30 of its length in x,
      // so an INSTANCE scale of 0.30 made a lance three pixels wide — a pink
      // wire falling out of the sky. The instance scale has to undo that
      // squeeze, not repeat it.
      w: i === 0 ? 1.55 : rnd(0.95, 1.2),
      len: i === 0 ? 2.7 : rnd(1.5, 2.2),
      tilt: i === 0 ? 0 : rnd(0.10, 0.22),
      late: i === 0 ? 0 : rnd(0.012, 0.045),
      roll: rnd(0, 3),
    });
  }

  // Column sprites, standing on the card. depthTest off for the same reason
  // shard fire's flames have it off: a sprite is depth-tested at the depth of
  // its anchor, which is down on the card, so the corpse being thrown clear
  // swallows the whole column for the first frames of the strike.
  const column = (colour, w) => {
    const m = new THREE.SpriteMaterial({
      map: beamTex(), color: colour, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const s = new THREE.Sprite(m);
    s.center.set(0.5, 0);
    s.position.set(base.x, base.y, base.z);
    s.scale.set(w, 0.01, 1);
    group.add(s);
    return s;
  };
  const beam = column(HOT, 2.6);
  const hotBeam = column(0xff87b0, 0.7);

  // A SPRITE IS NOT FORESHORTENED. It is a billboard: its height lands on the
  // screen at the same pixels-per-unit as a horizontal distance, while a real
  // point three units up only climbs 0.76 of that, because this camera looks
  // down about fifty degrees. Scaled to the true height the column overshot
  // the gather by half its own length and ran off the top of the board into
  // the HUD. The camera's ELEVATION never changes in this game — only its
  // angle around the table — so this is a constant and not a guess.
  const VSPR = 0.76;
  const H = (GY - base.y) * VSPR;
  // A thread of a beam, already joining the gather to its target through the
  // whole charge. Without it the column arrives out of nowhere and the strike
  // is a surprise rather than a threat being carried out; with it the last
  // quarter second is a drawn bow.
  const aim = column(HOT, 0.22);

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color: HOT, transparent: true, opacity: 0,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  flash.position.set(base.x, base.y + 0.18, base.z);
  group.add(flash);

  // The square itself lights up. Photographed full-frame rather than cropped,
  // the strike was a neat little spear on one card and nothing else in the
  // picture moved — for the most expensive card in the game the moment of
  // impact has to be the loudest frame on the table. This is a flat blaze
  // lying ON the card, which is what throws light across the three squares
  // around it.
  const blaze = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 4.0),
    new THREE.MeshBasicMaterial({
      map: glowTex(), color: PALE, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  blaze.rotation.x = -Math.PI / 2;
  // On the STONE, not on the card. exit.destroy below shatters the card on
  // this very frame, so anything pinned to the card's face is left hanging in
  // the air a tenth of a second later.
  blaze.position.set(base.x, FLOOR + 0.05, base.z);
  group.add(blaze);

  /* --------------------------------------------------- the wreckage */

  // What the lances leave: crystal DRIVEN IN, not thrown up.
  //
  // The first version fired these on ballistic arcs like shard fire's blades
  // and the last second of the motif was a pink flower opening on the square
  // — which is shard fire's picture, for a death, and this one is a card
  // being pinned. They stand where they landed, leaning out a little, and
  // cool off in place. The few that DO fly are small chips off the impact.
  const STUCK = 9, CHIPS = 12;
  const spikeMat = new THREE.MeshStandardMaterial({
    color: DEEP, emissive: HOT, emissiveIntensity: 0.9,
    roughness: 0.3, metalness: 0.05, flatShading: true, transparent: true,
  });
  const spikes = new THREE.InstancedMesh(splinter, spikeMat, STUCK + CHIPS);
  spikes.frustumCulled = false;
  spikes.castShadow = true;
  group.add(spikes);
  const sp = [];
  for (let i = 0; i < STUCK; i++) {
    const a = phase + (i / STUCK) * Math.PI * 2 + rnd(-0.32, 0.32);
    sp.push({
      a, r: rnd(0.12, 0.62),
      lean: rnd(0.14, 0.55),                 // out of vertical, away from centre
      len: rnd(0.45, 0.95), w: rnd(0.8, 1.1),
      rise: rnd(0.035, 0.08),                // how fast it comes through
    });
  }
  const chip = [];
  for (let i = 0; i < CHIPS; i++) {
    const a = rnd(0, Math.PI * 2);
    const out = rnd(0.9, 2.3);
    chip.push({
      a, vx: Math.cos(a) * out, vz: Math.sin(a) * out * 0.9, vy: rnd(2.0, 4.0),
      len: rnd(0.18, 0.4), spin: rnd(-15, 15), life: rnd(0.35, 0.75),
    });
  }
  const G = 11.5;

  const EMBERS = 30;
  const emGeo = new THREE.BufferGeometry();
  const emPos = new Float32Array(EMBERS * 3);
  const emCol = new Float32Array(EMBERS * 4);
  emGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
  emGeo.setAttribute('color', new THREE.BufferAttribute(emCol, 4));
  const embers = new THREE.Points(emGeo, new THREE.PointsMaterial({
    map: moteTex(), size: 0.19, sizeAttenuation: true, vertexColors: true,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  embers.frustumCulled = false;
  group.add(embers);
  const em = [];
  for (let i = 0; i < EMBERS; i++) {
    const a = phase + (i / EMBERS) * Math.PI * 2 + rnd(-0.4, 0.4);
    const r = rnd(0.3, 1.2);
    em.push({
      vx: Math.cos(a) * r, vz: Math.sin(a) * r * 0.9, vy: rnd(1.8, 3.6),
      born: T_HIT + rnd(0, 0.22), life: rnd(0.9, 1.7), flick: rnd(16, 32),
    });
  }

  // The burn OUTLIVES everything and is blended normally, dark on the stone.
  // An additive pink stain left behind is how a board ends up glowing.
  const scorch = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 2.3),
    new THREE.MeshBasicMaterial({
      map: scorchTex(), color: 0x1a0b0f, transparent: true, opacity: 0,
      depthWrite: false,
    }),
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.rotation.z = phase;
  scorch.position.set(base.x, FLOOR + 0.012, base.z);
  group.add(scorch);

  const cracks = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({
      map: crackTex(), color: HOT, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  cracks.rotation.x = -Math.PI / 2;
  cracks.rotation.z = phase * 1.7;
  cracks.position.set(base.x, FLOOR + 0.026, base.z);
  group.add(cracks);

  // ...and a second set ON the card, because in the harness (and for the beat
  // before the corpse is thrown) the card is still lying over the stone and
  // hiding everything drawn on it.
  const onCard = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    new THREE.MeshBasicMaterial({
      map: crackTex(), color: HOT, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  onCard.rotation.x = -Math.PI / 2;
  onCard.rotation.z = phase * 0.6;
  onCard.position.set(base.x, base.y + 0.057, base.z);
  group.add(onCard);

  /* --------------------------------------------------- the frame */

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;

    /* the mark: fades up through the cost, tightens, and is spent on impact */
    if (s < T_HIT) {
      const u = clamp01(s / (T_HIT - 0.05));
      rune.material.opacity = 0.30 + 0.55 * u ** 2;
      rune.scale.setScalar(1.55 - 0.55 * easeOut3(u));
      rune.rotation.z = -phase - s * 0.9;
    } else {
      // Snapped, not blown outward. It used to expand to 2.6x over 220ms and
      // what that drew was a big pale hoop drifting off the square while the
      // strike was still landing — the loudest thing in the frame was a grey
      // ring. It is spent in 90ms now and the shockwave does the expanding.
      const u = clamp01((s - T_HIT) / 0.09);
      rune.material.opacity = 0.9 * (1 - u) ** 2;
      rune.scale.setScalar(1 + u * 0.22);
    }

    /* the spent cards */
    for (let i = 0; i < CARDS; i++) {
      const c = cards[i];
      const age = s - c.born;
      const gone = s - c.burn;
      if (c.mesh) {
        if (age < 0) {
          c.mesh.visible = false;
        } else {
          c.mesh.visible = true;
          // DEALT, not inflated. A card that grows into the frame reads as a
          // window opening; this one comes up into place from below over
          // 110ms and then hangs, which is what being dealt looks like.
          const inK = clamp01(age / 0.11);
          let size = SIZE;
          let a = clamp01(age / 0.07);
          let lift = (1 - easeOut3(inK)) * 0.8;
          let char = 0, flare = 0;
          if (gone > 0) {
            // SPENT: it flares, closes down on its own centre and chars out
            // in 130ms. Fading it where it lay was tried and four cards
            // dimming in turn read as being switched off, not as being paid.
            const u = clamp01(gone / 0.13);
            size *= 1 + 0.10 * u - 0.95 * easeIn3(u);
            a = 1 - u ** 3;
            lift = 0;
            char = easeOut3(u);
            // A KICK ON THE FRAME IT GOES, and gone by halfway. Run as a
            // half-sine peaking in the middle of the burn at 0.8, the card
            // spent sixty milliseconds as a flat hot-pink rectangle with no
            // face on it — which is the invented plate this whole change
            // exists to delete, arriving by the back door. Front-loaded and
            // held under a half, the painting is still there the whole way
            // down and what the eye gets is a card CHARRING, not a card
            // turning into a pink card.
            flare = Math.max(0, 1 - u / 0.55) ** 0.7;
          }
          c.mesh.position.set(c.x, c.y - lift + Math.sin(s * 2.1 + c.bob) * 0.05, c.z);
          c.mesh.scale.setScalar(size);
          for (const e of c.mats) {
            e.m.opacity = a;
            e.m.emissiveIntensity = 0.5 * flare;
            // Charred as it goes, so the last thing the eye sees of the face
            // is it darkening rather than the painting simply disappearing.
            e.m.color.copy(e.base).multiplyScalar(1 - 0.78 * char);
          }
        }
      }

      const pu = clamp01(gone / 0.16);
      pops[i].material.opacity = gone > 0 && pu < 1 ? 0.95 * (1 - pu) ** 2 : 0;
      pops[i].scale.setScalar(0.5 + 2.6 * easeOut3(pu));
    }

    // Everything that belongs to the COST is off the screen before the kill
    // starts. The two beats have to be separate or the motif is one long
    // continuous glow and the card's own sentence stops being legible in it.
    const spent = clamp01((T_HIT - 0.05 - s) / 0.08);

    /* the streams */
    for (let i = 0; i < CARDS; i++) {
      const st = streams[i];
      const c = cards[i];
      const age = s - c.burn;
      const head = clamp01(age / T_DRAW);
      // The tail only leaves once the head has arrived, so the stream is a
      // drawn LINE first and a swallowed one second. Starting the tail with
      // the head made a short dash that crossed the gap, which reads as a
      // bullet rather than something being drained.
      const tail = clamp01((age - T_DRAW * 0.45) / (T_DRAW * 0.55));
      if (age <= 0 || tail >= 1) { st.st.mat.opacity = 0; st.st.mesh.visible = false; continue; }
      st.st.mesh.visible = true;
      const h = easeOut3(head), tl = easeIn3(tail);
      for (let k = 0; k < SEG; k++) {
        // index 0 at the gather end: pts run from head back to tail
        const u = h + (tl - h) * (k / (SEG - 1));
        curveAt(st, u, st.pts[k]);
      }
      st.st.lay(st.pts, { taper: 0.9 });
      st.st.mat.opacity = 0.95 * clamp01(age / 0.05) * (1 - tl) ** 0.6 * spent;
      st.st.mat.emissiveIntensity = 0.95 * (0.75 + 0.25 * Math.sin(s * 22 + i));
    }

    /* the motes */
    for (let i = 0; i < MOTES; i++) {
      const m = mo[i];
      const u = (s - m.born) / m.trip;
      const a4 = i * 4;
      if (u <= 0 || u >= 1) { moCol[a4 + 3] = 0; continue; }
      const st = streams[m.of];
      curveAt(st, easeOut3(u), vec);
      // they start scattered and are squeezed onto the line as they fall in
      const j = (1 - u) ** 1.5;
      moPos[i * 3] = vec.x + m.jx * j;
      moPos[i * 3 + 1] = vec.y + m.jy * j;
      moPos[i * 3 + 2] = vec.z + m.jz * j;
      tint.setRGB(1, 0.10 + 0.22 * u, 0.28 + 0.26 * u);
      moCol[a4] = tint.r; moCol[a4 + 1] = tint.g; moCol[a4 + 2] = tint.b;
      moCol[a4 + 3] = (0.55 + 0.45 * Math.sin(s * m.flick + i)) * clamp01(u * 6)
        * clamp01((1 - u) * 5) * spent;
    }
    moGeo.attributes.position.needsUpdate = true;
    moGeo.attributes.color.needsUpdate = true;

    /* the gather: grows a step for each card that arrives, then compresses */
    let fed = 0;
    for (let i = 0; i < CARDS; i++) if (s > cards[i].burn + T_DRAW * 0.6) fed++;
    const feed = clamp01(fed / CARDS + clamp01((s - T_BURN) / 0.8) * 0.25);
    // The core is SMALL. At 0.26 + 0.50 it was a fifty-pixel pink ball and
    // the splinters turning inside it were invisible — the gather looked like
    // a ball of flame, which belongs to another faction.
    let cs = 0.17 + 0.26 * feed;
    let ca = 0.5 * clamp01((s - T_BURN + 0.2) / 0.25);
    if (s > T_HIT - 0.09) {
      // it collapses to a point and lets go
      const u = clamp01((s - (T_HIT - 0.09)) / 0.09);
      cs *= 1 - 0.75 * u;
      ca *= 1 + 1.6 * u;
    }
    if (s > T_HIT) {
      const u = clamp01((s - T_HIT) / 0.2);
      cs *= 1 - u; ca *= (1 - u) ** 2;
    }
    core.scale.setScalar(cs * (1 + 0.06 * Math.sin(s * 26 + phase)));
    core.rotation.set(phase + s * 1.4, s * 2.1, phase * 0.5);
    coreMat.opacity = ca;
    // The halo used to be 6.5x the core and it turned the gather into a soft
    // pink cloud hanging over the far row — the faceted solid inside it was
    // completely lost. Kept close to the core it is a rim, not a fog.
    halo.scale.setScalar(cs * 5.0);
    halo.material.opacity = ca * 0.5;

    for (let i = 0; i < ORB; i++) {
      const o = orbit[i];
      const live = s > o.arrive && s < T_HIT;
      if (!live) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scl.setScalar(0));
        orbs.setMatrixAt(i, mat4);
        continue;
      }
      const k = clamp01((s - o.arrive) / 0.18);
      const ang = o.a + s * 1.7;                  // the whole knot turns slowly
      // drawn IN as it feeds, and squeezed again when it compresses
      const pull = (1.55 - 0.55 * k) * (1 - 0.45 * clamp01((s - (T_HIT - 0.09)) / 0.09));
      vec2.set(Math.cos(ang) * o.dr, o.dy, Math.sin(ang) * o.dr).normalize();
      q.setFromUnitVectors(UP, vec2);
      vec.copy(gather).addScaledVector(vec2, (0.1 + o.len * 0.45 * k) * pull);
      mat4.compose(vec, q, scl.setScalar(o.len * k));
      orbs.setMatrixAt(i, mat4);
    }
    orbs.instanceMatrix.needsUpdate = true;
    orbMat.opacity = clamp01((T_HIT - s) / 0.1);

    /* the strike */
    const hit = s - T_HIT;

    // the aiming thread, from the moment the gather is more than half fed
    if (s > T_BURN + 0.25 && hit < 0) {
      const u = clamp01((s - (T_BURN + 0.25)) / (T_HIT - T_BURN - 0.25));
      aim.scale.set(0.22 * (0.5 + u), H, 1);
      // Measured at t+780ms the thread was six pixels wide at fifteen per cent
      // and simply was not there, so the gather hung over the fighter with
      // nothing joining them and the strike still arrived out of nowhere.
      aim.material.opacity = (0.13 + 0.34 * u ** 3) * (0.7 + 0.3 * Math.sin(s * 30));
    } else {
      aim.material.opacity = 0;
    }

    for (let i = 0; i < LANCES; i++) {
      const L = lance[i];
      const e = hit - L.late;
      // It GROWS OUT of the gather rather than appearing whole. Built the
      // other way — full length from the first frame, tip parked above the
      // board until the drop began — a 2.7-unit spear hung motionless off the
      // top of the screen for eighty milliseconds before anything happened,
      // and in a still it read as a stray pink shape with nothing to do with
      // the square. Anchored at the gather, the length IS the fall.
      const drop = clamp01((e + 0.07) / 0.07);
      const tip = GY + 0.1 - (GY + 0.1 - (base.y - 0.06)) * easeIn3(drop);
      const brk = e > 0 ? clamp01(1 - e / 0.16) : 1;   // it breaks up on landing
      const len = Math.min(L.len, GY + 0.1 - tip) * brk;
      if (e < -0.07 || len < 0.02) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scl.setScalar(0));
        lances.setMatrixAt(i, mat4);
        continue;
      }
      // Splayed from a shared POINT: the tips land nearly together on the card
      // and the shafts lean apart going up, so the cluster is a fan of spears
      // converging on one square rather than five parallel rods.
      vec2.set(Math.cos(L.a) * L.tilt, 1, Math.sin(L.a) * L.tilt).normalize();
      q.setFromUnitVectors(UP, vec2);
      vec.set(base.x + Math.cos(L.a) * L.r * 0.22, tip, base.z + Math.sin(L.a) * L.r * 0.22)
        .addScaledVector(vec2, len * 0.5);
      const w = L.w * (0.5 + 0.5 * (len / L.len));
      mat4.compose(vec, q, scl.set(w, len, w * 0.9));
      lances.setMatrixAt(i, mat4);
    }
    lances.instanceMatrix.needsUpdate = true;
    lanceMat.opacity = hit > -0.08 && hit < 0.3 ? clamp01((0.18 - hit) * 8) : 0;

    if (hit > -0.02 && hit < 0.34) {
      // It COLLAPSES rather than spreading. Widening as it faded, the column
      // spent its last 200ms as a broad pale pink pane standing over the
      // square, which looks like smoke; narrowing, the same fade reads as the
      // charge being driven into the card.
      const u = clamp01(hit / 0.34);
      beam.scale.set(2.6 * (1.05 - 0.75 * u ** 0.7), H, 1);
      // Held at full for the first seventy milliseconds and dropped after.
      // Decaying from the instant of contact, the loudest frame of the whole
      // motif was already half gone by the time the eye reached it.
      beam.material.opacity = 0.95 * Math.min(1, (1 - u) * 5) ** 1.4
        * clamp01((hit + 0.02) / 0.03);
      const hu = clamp01(hit / 0.16);
      hotBeam.scale.set(0.7 * (1 - 0.55 * hu), H, 1);
      hotBeam.material.opacity = 0.8 * (1 - hu) ** 1.2;
    } else {
      beam.material.opacity = 0;
      hotBeam.material.opacity = 0;
    }

    if (hit > 0 && hit < 0.45) {
      // two flashes on top of each other: a small one that is gone in 70ms,
      // which is the hit, and a wide one that takes 450ms, which is the light
      // it throws. One alone is either a pop or a swell, never a blast.
      const u = clamp01(hit / 0.45);
      const h = clamp01(hit / 0.07);
      flash.scale.setScalar(1.6 + 9.0 * easeOut3(u));
      flash.material.opacity = 0.7 * (1 - u) ** 2 + 1.1 * (1 - h) ** 1.5;
      const b = clamp01(hit / 0.2);
      blaze.scale.setScalar(0.35 + 0.85 * easeOut3(b));
      blaze.material.opacity = 1.0 * (1 - b) ** 1.3;
    } else {
      flash.material.opacity = 0;
      blaze.material.opacity = 0;
    }

    /* the wreckage */
    for (let i = 0; i < STUCK; i++) {
      const b = sp[i];
      if (hit <= 0 || hit > 1.5) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scl.setScalar(0));
        spikes.setMatrixAt(i, mat4);
        continue;
      }
      // comes through in under a tenth of a second and then stands still —
      // the violence is over, this is what is left of it
      const k = easeOut3(clamp01(hit / b.rise)) * clamp01((1.3 - hit) / 0.45);
      vec2.set(Math.cos(b.a) * Math.sin(b.lean), Math.cos(b.lean),
        Math.sin(b.a) * Math.sin(b.lean));
      q.setFromUnitVectors(UP, vec2);
      // Its foot is buried: the instance centre is less than half its length
      // above the stone, so a third of every shard is under the flagstone and
      // they read as driven IN rather than stood on top like ornaments.
      // rooted in the STONE: the lances went through the card and into the
      // flagstone, and the card is being blown apart on the same frame
      vec.set(base.x + Math.cos(b.a) * b.r, FLOOR + 0.04, base.z + Math.sin(b.a) * b.r)
        .addScaledVector(vec2, b.len * 0.30 * k);
      mat4.compose(vec, q, scl.set(b.w * k, b.len * k, b.w * 0.9 * k));
      spikes.setMatrixAt(i, mat4);
    }
    for (let i = 0; i < CHIPS; i++) {
      const c = chip[i];
      const u = hit / c.life;
      if (u <= 0 || u >= 1) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scl.setScalar(0));
        spikes.setMatrixAt(STUCK + i, mat4);
        continue;
      }
      vec.set(base.x + c.vx * hit,
        Math.max(FLOOR + 0.05, FLOOR + 0.12 + c.vy * hit - 0.5 * G * hit * hit),
        base.z + c.vz * hit);
      vec2.set(-Math.sin(c.a), 0.35, Math.cos(c.a)).normalize();
      q.setFromAxisAngle(vec2, c.spin * hit + i);
      mat4.compose(vec, q, scl.setScalar(c.len * 2.4 * Math.min(1, (1 - u) * 3)));
      spikes.setMatrixAt(STUCK + i, mat4);
    }
    spikes.instanceMatrix.needsUpdate = true;
    // Cools FAST. Held at 0.9 for half a second the cluster photographed as
    // one flat magenta silhouette standing on the card — cut paper, not
    // crystal. Once the emissive is down near the light in the room the
    // facets take the blast's own light and you can see a lit side and a dark
    // side, which is the only thing that says crystal at this size.
    spikeMat.emissiveIntensity = 0.55 * Math.max(0.05, 1 - hit * 2.0);
    spikeMat.opacity = clamp01((1.3 - hit) / 0.4);

    for (let i = 0; i < EMBERS; i++) {
      const e = em[i];
      const u = (s - e.born) / e.life;
      const a4 = i * 4;
      if (u <= 0 || u >= 1) { emCol[a4 + 3] = 0; continue; }
      const es = s - e.born;
      emPos[i * 3] = base.x + e.vx * es * (1 - 0.3 * u);
      emPos[i * 3 + 1] = Math.max(FLOOR + 0.05, base.y + e.vy * es - 3.9 * es * es);
      emPos[i * 3 + 2] = base.z + e.vz * es * (1 - 0.3 * u);
      tint.setRGB(1 - u * 0.5, 0.12 * (1 - u), 0.26 * (1 - u));
      emCol[a4] = tint.r; emCol[a4 + 1] = tint.g; emCol[a4 + 2] = tint.b;
      emCol[a4 + 3] = (0.6 + 0.4 * Math.sin(s * e.flick + i)) * (1 - u) * clamp01(u * 12);
    }
    emGeo.attributes.position.needsUpdate = true;
    emGeo.attributes.color.needsUpdate = true;

    /* what is left */
    const sc = clamp01(hit / 0.12);
    scorch.material.opacity = 0.62 * sc * (s > 1.9 ? Math.max(0, 1 - (s - 1.9) / 0.6) : 1);
    scorch.scale.setScalar(0.7 + 0.3 * clamp01(hit / 0.3));

    const co = clamp01(hit / 0.06);
    const cool = Math.max(0, 1 - hit / 1.5) ** 1.5;
    const out = s > 1.9 ? Math.max(0, 1 - (s - 1.9) / 0.6) : 1;
    const flick = 0.82 + 0.18 * Math.sin(s * 19 + phase);
    cracks.scale.setScalar(0.5 + 0.5 * easeOut3(co));
    cracks.material.opacity = co * (0.16 + 0.6 * cool) * flick * out;
    // ...and it is gone within a third of a second, because the card it is
    // drawn on is in nine pieces by then and a crack plane floating over bare
    // stone is a bug you only see in the later frames.
    const held = clamp01((0.34 - hit) / 0.12);
    onCard.scale.setScalar(0.62 + 0.38 * easeOut3(co));
    // Brighter than the stone's set. The card underneath is a full-colour
    // painting and a thin additive pink line over it disappears; the stone is
    // grey and takes the same line at half the strength.
    // ...and capped. Run up near 1 the additive pink sat on top of a
    // full-colour painting and clipped to white, so the card had scratches on
    // it rather than cracks through it.
    onCard.material.opacity = Math.min(0.62, co * (0.24 + 0.7 * cool)) * flick * out * held;
    tint.setRGB(1, 0.18 * cool + 0.02, 0.36 * cool + 0.06);
    cracks.material.color.copy(tint);
    onCard.material.color.copy(tint);
  });

  /* --------------------------------------------------- the ground ring */

  // Drawn here rather than with kit.ring, which scales a fixed-width annulus:
  // asked for a ring this size the band scales with the radius and stops being
  // a shockwave, becoming a solid pink puddle around the card.
  kit.after(T_HIT, () => {
    // Two of them: a hard fast one that is the crack going out and a wide
    // slow one behind it. One alone was a neat hoop expanding politely, which
    // is decoration; two at different speeds is a shock.
    const shock = (r0, span, scale, alpha, y) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r0, 1, 64),
        new THREE.MeshBasicMaterial({
          color: HOT, transparent: true, opacity: 0, depthWrite: false,
          side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(base.x, y, base.z);
      kit.hold(ring, span, (t) => {
        const e = easeOut3(t);
        ring.scale.setScalar(0.3 + scale * e);
        ring.material.opacity = alpha * (1 - t) ** 1.6;
      });
    };
    shock(0.95, 0.32, 1.5, 0.95, FLOOR + 0.04);
    shock(0.82, 0.62, 2.6, 0.38, FLOOR + 0.035);

    // Nothing here touches the victim any more. It used to be pressed into
    // the stone with `piece.lift`, which was the right idea and the wrong
    // owner: `exit.destroy` below now takes the card over on this exact
    // frame, and two things moving one card is the bug this whole change is
    // about.
  });

  /* --------------------------------------------------- light */

  // THE FAN'S OWN LIGHT — the one thing without which none of this works.
  //
  // The key in this arena is a spotlight confined to the flagstones and the
  // apron round it is nearly black, so four cards hanging two and a half
  // units ABOVE the board get almost nothing: photographed without this they
  // were four dark rectangles with a pink rim and a Goblin Hunter could not
  // be told from an Orc Soldier. Warm white, because the pink belongs to
  // everything else in the motif and a pink card is a card you cannot read.
  //
  // Reach 5.0 and NOT more. At 8 it lit the three squares under the fan as
  // well and the board brightened for half a second for no reason a player
  // could name; cut off not far past the cards, all it lights is the price.
  // 5.0 rather than 4.2 because the cutoff window was biting the OUTER cards
  // of a four-card fan, which are half a unit further from the lamp than the
  // middle pair — the two ends of the hand came out a stop darker than its
  // middle and read as two cards behind two cards.
  const fanSpan = T_BURN + T_STEP * (CARDS - 1) + 0.22;
  const fanL = new THREE.PointLight(0xffe8d2, 0, 5.0, 1.6);
  // Above and toward the camera: these cards lie face UP, so the light that
  // shows the painting is the one over them.
  fanL.position.set(base.x, FANY + 2.0, base.z + 1.3);
  kit.hold(fanL, fanSpan, (t) => {
    const s = t * fanSpan;
    // Up with the deal, held flat through the beat that has to be COUNTED,
    // and out with the last card. Left burning past the fan it was a bare
    // lamp hanging over an empty square while the streams crossed the board.
    fanL.intensity = 16 * clamp01(s / 0.16)
      * clamp01((fanSpan - s) / 0.18) ** 1.4;
  });

  // The gather's own light. Reach 4.0 from three and a half units up, with
  // quadratic decay, so what it really lights is the crystal turning inside
  // it and the top of the column; by the time it reaches the flagstones there
  // is almost nothing left of it, which is right — the board is not supposed
  // to know about this yet.
  const up = new THREE.PointLight(PALE, 0, 4.0, 2);
  // OFF CENTRE. Hung in the middle of the knot it lit every splinter
  // square-on from the inside and they all came out the same shade.
  up.position.set(gather.x + 0.9, gather.y + 0.8, gather.z + 0.7);
  kit.hold(up, T_HIT + 0.05, (t) => {
    const s = t * (T_HIT + 0.05);
    up.intensity = 5 * clamp01((s - T_BURN + 0.1) / 0.3) ** 2
      * (s > T_HIT - 0.09 ? 2.4 : 1);
  });

  kit.after(T_HIT - 0.01, () => {
    // off centre and high, so the crystal gets a lit face and a dark one —
    // hung in the middle of the blast every splinter lights square-on and
    // they all come out the same shade, which reads as cut paper
    // Reach 5.6 and power 18 — deliberately bigger than shard fire's, which
    // is kept local because a chain of six can be alight at once. This one
    // fires ONCE in a game and is the price of four cards; it is allowed to
    // light the squares around it.
    const hitL = new THREE.PointLight(0xff5a92, 0, 6.2, 2);
    hitL.position.set(base.x + Math.cos(phase) * 0.6, base.y + 1.0,
      base.z + Math.sin(phase) * 0.6);
    kit.hold(hitL, 0.45, (t) => {
      hitL.intensity = 24 * (1 - t) ** 1.9 * (t < 0.06 ? t / 0.06 : 1);
    });
    // Hung at the card's own height this sat INSIDE the crystal it was meant
    // to light and every shard came out the same flat shade. From above and
    // to one side each one gets a lit face and a dark one.
    const glow = new THREE.PointLight(0xff3a72, 0, 3.6, 2);
    glow.position.set(base.x - Math.sin(phase) * 0.7, base.y + 1.25,
      base.z - Math.cos(phase) * 0.7);
    kit.hold(glow, 1.5, (t) => {
      glow.intensity = 4.2 * (1 - t) ** 2.0 * (0.78 + 0.22 * Math.sin(t * 44 + phase));
    });
  });
}

/* ------------------------------------------------------- the card's end */

// The card must still BE THERE while the cost is paid. Arcane Blast spends a
// second gathering four cards' worth of force before anything touches the
// fighter, so without this the victim is thrown at the discard pile on the
// first frame and the whole sequence is a lot of trouble taken over an empty
// square. The lances land at T_HIT; that is exactly when the card's own end
// begins, and the two are one event.
export const timing = { kill: T_HIT };

export const exit = {
  /**
   * OBLITERATED, not knocked over.
   *
   * The generic death is a good death for a sword: the card is struck flat,
   * given a red burst and a red ring, and thrown onto the pile. Played after
   * this motif it was a second, unrelated killing — a fighter that had just
   * had five crystal lances driven through it got up, was hit by something
   * invisible, and fell over. The card costs several cards out of hand; it
   * has to come apart.
   *
   * So the card is cut into nine pieces along the lines the strike broke it
   * on, punched down into the stone, blown out, and then swept to the pile as
   * charred fragments. The pieces GO SOMEWHERE — burning them out in place
   * reads as the card being deleted rather than discarded, and the eye loses
   * where it went.
   */
  destroy(kit, piece, square, ev, done) {
    const finish = () => {
      // Pieces are POOLED. A card left invisible, or dark, or turned, is a
      // ghost the next time this slot is used.
      piece.group.visible = true;
      piece.animating = false;
      done?.();
    };
    // Never strand a card. If anything about this piece is not what the
    // exit needs, the generic death is still a death.
    if (!piece) { done?.(); return; }
    if (!piece.card3d || !piece.frontMat) { kit.anim.destroy(piece, square, done); return; }

    const at = piece.group.position.clone();
    const pile = kit.grave(piece.owner);
    const yaw = piece.card3d.rotation.y;
    piece.animating = true;
    piece.group.visible = false;

    // Where it broke. Three bands each way on JITTERED lines: an even 3x3 is
    // a chocolate bar, and nine identical squares flying apart read as a grid
    // dissolve rather than as something shattering.
    const cutX = [-CARD_W / 2, rnd(-0.24, -0.05) * CARD_W, rnd(0.05, 0.24) * CARD_W, CARD_W / 2];
    const cutZ = [-CARD_H / 2, rnd(-0.26, -0.06) * CARD_H, rnd(0.06, 0.26) * CARD_H, CARD_H / 2];

    const UP2 = new THREE.Vector3(0, 1, 0);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(UP2, yaw);
    // The card's face is the +Y face of a box whose own yaw turns it to face
    // its owner, so a flat plane standing in for a piece of it needs BOTH:
    // laid down, then turned. Composed the other way round the art on the
    // far player's cards came apart mirrored.
    const qBase = yawQ.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));

    const grp = new THREE.Group();
    const bits = [];
    const off = new THREE.Vector3();
    for (let ix = 0; ix < 3; ix++) {
      for (let iz = 0; iz < 3; iz++) {
        const x0 = cutX[ix], x1 = cutX[ix + 1], z0 = cutZ[iz], z1 = cutZ[iz + 1];
        const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
        // each piece keeps ITS OWN patch of the card's picture
        const u0 = (x0 + CARD_W / 2) / CARD_W, u1 = (x1 + CARD_W / 2) / CARD_W;
        const v0 = 1 - (z1 + CARD_H / 2) / CARD_H, v1 = 1 - (z0 + CARD_H / 2) / CARD_H;
        const uv = geo.attributes.uv;
        uv.setXY(0, u0, v1); uv.setXY(1, u1, v1);
        uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
        uv.needsUpdate = true;

        // CLONED, never the piece's own material: kit.hold disposes everything
        // it is given, and disposing a pooled card's face material would take
        // the card out with it.
        const m = piece.frontMat.clone();
        m.side = THREE.DoubleSide;
        m.transparent = true;
        const mesh = new THREE.Mesh(geo, m);
        mesh.castShadow = true;
        grp.add(mesh);

        const lx = (x0 + x1) / 2, lz = (z0 + z1) / 2;
        off.set(lx, 0, lz).applyQuaternion(yawQ);
        const home = new THREE.Vector3(at.x + off.x, at.y + 0.012, at.z + off.z);
        // PLACED HERE, not only in the tick. A tween added part-way through
        // an animator pass is not stepped until the NEXT frame, so for one
        // frame every piece sat at the world origin inside the middle
        // flagstone — and the frame that happened on was the frame of the
        // strike, so the card blinked out just as the lances landed.
        mesh.position.copy(home);
        mesh.quaternion.copy(qBase);
        const rad = Math.hypot(lx, lz) || 1;
        const out = new THREE.Vector3(off.x / rad, 0, off.z / rad);
        bits.push({
          mesh, m, home,
          base: m.color.clone(),
          // Thrown properly. At half these speeds the nine pieces were still
          // a card-shaped cluster a fifth of a second after the strike — it
          // read as a card someone had sliced, not one that had been hit.
          vx: out.x * rnd(1.6, 3.2) + rnd(-0.4, 0.4),
          vz: out.z * rnd(1.6, 3.2) + rnd(-0.4, 0.4),
          vy: rnd(3.2, 5.6),
          axis: new THREE.Vector3(rnd(-1, 1), rnd(-0.4, 0.4), rnd(-1, 1)).normalize(),
          spin: rnd(-9, 9), tip: rnd(-0.4, 0.4),
          // the pile is a stack, so they do not all land on one point
          tx: pile.x + rnd(-0.5, 0.5), tz: pile.z + rnd(-0.5, 0.5),
          lag: rnd(0, 0.12),
        });
      }
    }

    const SPAN2 = 1.25;
    const q2 = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    kit.hold(grp, SPAN2, (t) => {
      const s = t * SPAN2;
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i];
        // 1. PUNCHED. The first 70ms the pieces do not fly at all — they are
        // driven down into the flagstone, still in the shape of a card. Blown
        // apart from frame one there was no impact in it, only debris.
        const punch = clamp01(s / 0.07);
        const e = Math.max(0, s - 0.07 - b.lag);
        pos.set(b.home.x + b.vx * e,
          Math.max(FLOOR + 0.03, b.home.y - 0.06 * easeOut3(punch) + b.vy * e - 5.9 * e * e),
          b.home.z + b.vz * e);

        // 2. SWEPT to the pile. Smoothstep, so it leaves the tumble and joins
        // the sweep without a corner in the path.
        // ...and gathered up again quickly. Thrown harder and swept later,
        // half the pieces spent a quarter second lying flat on the two
        // neighbouring cards, which is litter, not a death.
        const k = clamp01((s - 0.44) / 0.6);
        const kk = k * k * (3 - 2 * k);
        if (k > 0) {
          pos.lerp(vec3set(b.tx, pile.y + 0.42, b.tz), kk);
          pos.y += Math.sin(Math.PI * kk) * 0.75;
        }
        b.mesh.position.copy(pos);
        // buckled by the punch before it ever leaves the stone
        q2.setFromAxisAngle(b.axis, b.spin * e + b.tip * easeOut3(punch));
        b.mesh.quaternion.copy(q2).multiply(qBase);
        b.mesh.scale.setScalar(1 - 0.32 * kk);
        // Charred. It was hit by the thing that killed it, and a bright clean
        // card fragment sailing away looks like a card that got up and left.
        // Charred to a little under half, not to nearly black. Burnt down to
        // 0.28 the fragments were invisible against dark stone the moment the
        // pink light went out, so the sweep to the pile — the part that says
        // where the card WENT — happened off screen.
        b.m.color.copy(b.base).multiplyScalar(1 - 0.55 * clamp01(s / 0.5));
        b.m.opacity = kk > 0.72 ? 1 - (kk - 0.72) / 0.28 : 1;
      }
    }, finish);
  },
};

// one scratch vector for the sweep target, so the exit allocates nothing per
// frame with nine pieces in flight
const SCRATCH = new THREE.Vector3();
function vec3set(x, y, z) { return SCRATCH.set(x, y, z); }
