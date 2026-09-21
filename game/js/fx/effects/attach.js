// ATTACH — something is bound onto a fighter, and it stays there.
//
// Shared by 4 cards: A002 Bolt Bender (takes an Attachment out of your hand
// onto itself, or swaps the one it has), A005 Bolt Golem (deploys beside an
// Attachment and takes it), A033 Fatewoven Tapestry and A050 Inquisitorial
// Mandate (both attach themselves to a fighter you control).
//
// Two of them are Auroxi cloth and two are Refractory paper and iron, so the
// motif cannot be made of either. What it IS made of is the SHAPE of the act —
// something arrives, is drawn round the fighter, is pulled tight, and is still
// there afterwards — and it takes its colour from the faction it is handed.
// A band of woven stuff serves both: it is the bolt the Auroxi fight with, and
// it is the ribbon on an Inquisitor's writ.
//
// The shape is A SASH AND A SEAL, on the diagonal. Every other mark this game
// puts on a card is centred and symmetrical — the brand's spiked ring, the
// possessing shadow's rectangle, the crystal border a graft leaves — and a
// band running corner to corner is the one of them you can name at sixty
// pixels without reading anything. Its ENDS DIVE UNDER THE CARD, which is what
// makes it read as bound on rather than printed on — a band that stops at the
// edges is a stripe in the art, and a band that goes out of sight beneath one
// has been round the thing.
//
// AND IT DOES NOT CLEAR. Attachments persist in the rules, so this is the one
// motif in the set that is allowed to finish with the fighter still visibly
// marked. The band holds for the best part of half a second after it is
// cinched, and the seal is the last thing to go out.
//
// WHAT THIS IS NOT. chains.js also winds something round a card, and stays
// clear of this one by being made of LINKS, by taking two turns, and above all
// by coming OFF again and hauling the card away — an attachment is the
// opposite of that. brand.js also leaves a mark, but its mark is burned on by
// a tool that comes down out of the dark, and it cools and dies. And the bolts
// in cloth-kit.js unroll off a rod on ANOTHER card and helix a body into a
// cocoon; this is one band, one turn, lying flat, going nowhere.
//
// Preview — `t` is MILLISECONDS INTO THE MOTIF, because --settle is wall clock
// and headless Chrome draws this table at a few frames a second:
//   node tools/shot.js --url "game/?quick=1&seed=5&t=800" \
//     --eval tools/fxdemo/attach.js --out /tmp/a.png --wait 10000 --settle 600
// &iron=1 is the Refractory case, &held=1 the one where the motif is handed
// the attachment's own uid instead of the fighter's.

import { THREE, CARD_W, CARD_H, FACTION, easeOut, easeIn } from '../kit.js';
import { weave } from '../cloth-kit.js';
import { blobTexture } from '../../textures.js';

/* ---------------------------------------------------------------- timings */

/** Phase boundaries in seconds, not durations. */
const A = {
  LAY: 0.10,      // the far end of the band touches down
  BIND: 0.62,     // the whole of it is on and its ends are under the card
  CINCH: 0.76,    // pulled tight, and the seal set on it
  HOLD: 1.26,     // it simply sits there, which is the point of the card
  TOTAL: 1.66,
};

// The band, in world units. A card is 1.74 across and about 60 screen pixels,
// so 0.23 of width is eight of them — wide enough to be a strap rather than a
// wire, and narrow enough that the art underneath still reads.
const BAND = 0.23;

// How the wrap sits on the card. FACE is measured from the card GROUP's
// origin, whose face is half a card's thickness above it: 0.055 is the same
// clearance every flat thing in this set has had to buy, because at this
// camera the depth buffer cannot separate a centimetre and a band laid at
// +0.02 drew on the flagstones around the card and not on the card.
const FACE = 0.055;
// Over what length of its run the band dives out of sight at each end, and how
// far down it goes. See seat() — this is how the wrap is drawn now, and it
// replaced an explicit turn-the-edge-and-tuck-underneath profile that did not
// survive contact with a quad strip.
const EDGE = 0.36;
const SINK = 0.115;

/* --------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map.
const TEXES = new Map();
function tex(key, paint, w = 128, h = 128) {
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
 * The linen out of ../cloth-kit.js, CLONED.
 *
 * The bolts' own weave is a module-level singleton and its repeat is part of
 * how they tile it along their length; writing `repeat` on it here would
 * silently restretch the cloth in all six bolts. A clone shares the canvas and
 * owns its own wrapping, which costs one extra upload and nothing else.
 *
 * Flat colour was tried first and cloth-kit is right about it: with nothing
 * for the braziers to catch on, a plain strip has no surface, and no surface
 * means no weight. The ribs run ACROSS the band because that is the way cloth
 * creases, which is the u axis of kit.strip.
 */
let LINEN = null;
function linen() {
  if (LINEN) return LINEN;
  const w = weave();
  const cut = (src, srgb) => {
    const t = src.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 1);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  LINEN = { map: cut(w.map, true), alpha: cut(w.alpha, false) };
  return LINEN;
}

/**
 * The seal: what is left on the fighter.
 *
 * A DIAMOND, and deliberately not a ring. brand.js already owns the ring on
 * this board — a conviction is an O with four spikes burned into the card —
 * and a second round mark in the same faction's colours would be read as a
 * second conviction. A lozenge lying on the band reads as a fastening: a wax
 * seal on a writ, a clasp on a bolt of cloth.
 *
 * It is painted DARK-BODIED with a hot ring. An additive shape at this size is
 * a white lozenge whatever colour it is given — ACES has no headroom left once
 * two bright things overlap — so the body is near-black, drawn over the band
 * at full coverage, and only the ring and the centre add.
 *
 * EVERYTHING HERE IS DRAWN FAT. The whole seal is seventeen screen pixels, so
 * the first cut's 0.035-of-a-canvas outline came out at six tenths of a pixel
 * and did not exist: the seal was a dark smudge on the band with no shape in
 * it at all. Nothing in this texture is thinner than an eighth of its width.
 */
const sealTex = (key, hot) => tex(key, (g, S) => {
  const c = S / 2;
  const R = S * 0.40;
  const face = (r) => {
    g.beginPath();
    g.moveTo(c, c - r);
    g.lineTo(c + r * 0.74, c);
    g.lineTo(c, c + r);
    g.lineTo(c - r * 0.74, c);
    g.closePath();
  };
  if (hot) {
    // a thick ring, cut out of a solid lozenge rather than stroked, and a hard
    // centre inside it — two pixels of light, two of dark, two of light
    g.filter = `blur(${S * 0.014}px)`;
    g.fillStyle = 'rgba(255,255,255,1)';
    face(R * 0.96); g.fill();
    g.globalCompositeOperation = 'destination-out';
    face(R * 0.56); g.fill();
    g.globalCompositeOperation = 'source-over';
    face(R * 0.24); g.fill();
    g.filter = 'none';
  } else {
    // the body, and a black keyline round the whole device: line art on a card
    // this busy holds together on its dark edge and nothing else
    g.fillStyle = 'rgba(255,255,255,1)';
    g.filter = `blur(${S * 0.016}px)`;
    face(R * 1.16); g.fill();
    g.filter = 'none';
  }
});

let MOTE = null;
const motePuff = () => (MOTE ||= blobTexture('rgba(255,242,222,1)', 'rgba(200,150,80,0)'));

/* ------------------------------------------------------------- the pieces */

/**
 * The fighter this is being fixed TO.
 *
 * `at` is whatever card resolved. For Bolt Bender and Bolt Golem that is the
 * fighter itself and there is nothing to do. For the two tactics it is the
 * ATTACHMENT, which is not a piece on the board at all — attachments live in
 * the host card's `attachments` array — so kit.piece() answers null and the
 * motif would play on nothing. Worse than nothing: kit.at() falls back to
 * reading a bare number as a SQUARE INDEX, and uids start at 1, so a low uid
 * would have painted this on square 3.
 */
function hostOf(kit, at) {
  const direct = kit.piece(at);
  if (direct) return direct;
  for (const p of kit.pieces?.byUid?.values?.() || []) {
    if ((p.card?.attachments || []).some((a) => a.uid === at)) return p;
  }
  return null;
}

const restOf = (p) => (p?.restingPosition ? p.restingPosition() : p.group.position.clone());
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------------ motif */

export function attach(kit, at, faction) {
  const host = hostOf(kit, at);
  if (!host) return;
  const anchor = restOf(host);
  const look = FACTION[faction] || FACTION.Neutral;
  const colour = new THREE.Color(look.spark);

  // The band lies on a diagonal, leaning a little differently every time. Two
  // attachments on the board at the same angle read as one texture stamped
  // twice, which is the note brand.js left about its own mark.
  const yaw = Math.PI * 0.25 + (Math.random() - 0.5) * 0.5;
  // and it runs toward its OWNER's seat, because that is the side the cloth
  // comes in from
  const side = host.owner === 0 ? 1 : -1;
  const dir = new THREE.Vector3(Math.cos(yaw) * side, 0, Math.sin(yaw) * side);

  // WHERE THE CARD'S EDGE IS ALONG THE RUN, which is a ray-against-rectangle
  // and NOT the support function chains.js uses to size its turns. The support
  // function answers how far the card reaches WHEN PROJECTED onto the run, and
  // the two agree only at 45 degrees on a square card: at 59 degrees they are a
  // fifth of a unit apart, and that fifth of a unit is exactly how far past the
  // corner the band folded — so the turn and the tuck that are supposed to be
  // hidden under the card happened out on the open flagstone, in plain sight,
  // and the strap read as a lath lying across the square.
  const R = Math.min(CARD_W * 0.5 / Math.max(1e-4, Math.abs(dir.x)),
    CARD_H * 0.5 / Math.max(1e-4, Math.abs(dir.z)));
  // ...and the band stops a little SHORT of it. By the time it gets there it
  // has already sunk below the card's top face, but a band has WIDTH, and the
  // two outer corners of its last quad were still catching daylight past the
  // card's edge — a small bright wedge sticking out onto the flagstone at each
  // end, which is exactly the tell the dive is meant to hide. Stopping 0.13
  // inside puts both corners within the footprint.
  const HALF = R - 0.13;

  /**
   * Where a point of the band ends up, at signed distance `m` from the middle:
   * flat across the face, then DIVING under the card at each end.
   *
   * That the ends go out of sight under the card is the whole reason this
   * reads as BOUND ON rather than printed on. The card is opaque and writes
   * depth, the band is transparent and does not, so anything the band does
   * below the card's top face and inside its footprint is simply gone.
   *
   * THE WRAP IS NOT MODELLED. The first version went over the edge properly —
   * down the rim, back underneath, the lot — and it was wrong twice over. The
   * return half doubles the path back on itself, and a quad strip through a
   * reversal is a bowtie; worse, the whole turn is 0.09 units of a run nearly
   * three long, so a 48-point band gave it ONE AND A HALF POINTS and what came
   * out was a pale vertical flap standing off the card's edge. Since none of
   * the underneath is ever visible from a camera nineteen units up, the honest
   * thing and the cheap thing are the same: sink the band out of sight before
   * it reaches the edge and stop.
   */
  const seat = (m, out, tight) => {
    const q = clamp01((Math.abs(m) - (R - EDGE)) / EDGE);
    const up = FACE - tight * 0.014 - SINK * (q * q * (3 - 2 * q));
    return out.set(anchor.x + dir.x * m, anchor.y + up, anchor.z + dir.z * m);
  };

  /* --- the band. kit.strip gives a lit quad strip that takes the brazier
     light and casts a shadow, which is what keeps it from being a decal. */
  const SEG = 48;
  const strap = kit.strip({
    segments: SEG, width: BAND, colour: look.spark, emissive: 0.26,
  });
  // DYED, not bare. kit.strip tints both the body and the emissive with one
  // colour, and at the faction's own value the linen came out the colour of
  // pale wood: a bright lath lying across a bright card, with no contrast
  // against the art it is supposed to be strapped over. The body is taken
  // down to about half and the emissive left where it is, so the band is dark
  // cloth that the faction's light runs through.
  strap.mat.color.multiplyScalar(0.46);
  const cloth = linen();
  strap.mat.map = cloth.map;
  strap.mat.emissiveMap = cloth.map;
  strap.mat.alphaMap = cloth.alpha;
  // alphaTest rather than plain blending, which is also what buys the ending:
  // as opacity falls the weave is eaten away from the frayed selvedges inward,
  // so the band goes the way cloth goes rather than turning into a ghost of
  // itself. It is cloth-kit's recipe and the reason the alpha channel of the
  // weave carries the fray at all.
  strap.mat.alphaTest = 0.3;
  strap.mat.needsUpdate = true;

  // WHERE IT COMES IN FROM: over the table from its owner's seat, which is the
  // near edge for player 0 and the far one for player 1. Taken as -dir — back
  // along the band's own run — it flew in over the far wall for both players,
  // which is nobody's hand.
  //
  // It is held as an OFFSET from each point's final place rather than as a
  // path of its own, so the band keeps its shape the whole way in. A strip
  // that has to find its shape on arrival arrives as a shapeless flap, and at
  // this size a flap is a smudge.
  const IN_ = new THREE.Vector3(side * -0.6, 0.80, side * 2.0);

  const pts = [];
  for (let i = 0; i < SEG; i++) pts.push(new THREE.Vector3());

  kit.hold(strap.mesh, A.TOTAL, (t) => {
    const s = t * A.TOTAL;
    // how hard it is pulled in against the card
    const tight = s < A.BIND ? 0
      : s < A.CINCH ? easeOut((s - A.BIND) / (A.CINCH - A.BIND)) : 1;
    // and the shiver that runs through it when the slack goes
    const ring = s > A.CINCH - 0.02 && s < A.CINCH + 0.4
      ? Math.sin((s - A.CINCH) * 46) * 0.035 * Math.exp(-(s - A.CINCH) * 9) : 0;

    for (let i = 0; i < SEG; i++) {
      const u = i / (SEG - 1);
      const m = (u - 0.5) * 2 * HALF;
      seat(m, pts[i], tight);
      // Laid down progressively from the far end, so the end nearest its owner
      // — the end it is still being paid out from — is the last to settle.
      // Released together the whole band landed as one object, and a thing
      // that lands all at once has no direction in it.
      const fall = A.BIND - A.LAY;
      const own = fall * 0.55;
      const k = clamp01((s - A.LAY - u * (fall - own)) / own);
      if (k < 1) {
        const e = 1 - easeIn(k);
        pts[i].addScaledVector(IN_, e);
        // it flutters on the way in and stills as it lands
        pts[i].y += Math.sin(u * 9 - s * 12) * 0.11 * e;
      }
      if (ring) pts[i].y += ring * Math.sin(u * Math.PI) * (1 - tight * 0.4);
    }
    // The twist gives it creases; a strip with none is a painted stripe. NO
    // TAPER, though — kit.strip tapers from one end only, so at 0.18 the band
    // came to a point and read as a leaf or a blade. A strap is the same width
    // all the way along, and that is most of what makes it a strap.
    strap.lay(pts, { taper: 0, twist: 1.2 + s * 2 });

    // It brightens as it is pulled tight and then settles back to cloth. Held
    // at the flash it was a strip of neon lying on a card; held at the resting
    // value the cinch had no beat at all.
    const flare = Math.max(0, 1 - Math.abs(s - A.CINCH) / 0.2) ** 2;
    strap.mat.emissiveIntensity = 0.14 + 0.16 * (1 - tight) + 0.55 * flare;
    strap.mat.opacity = s < A.HOLD ? 1
      : Math.max(0, 1 - (s - A.HOLD) / (A.TOTAL - A.HOLD)) ** 0.8;
  });

  /* --- the seal, set on the band where it crosses the middle of the card. */
  const seal = new THREE.Group();
  seal.position.set(anchor.x, anchor.y + FACE + 0.022, anchor.z);
  seal.rotation.y = -yaw * side;
  const face = (map, tint, blending, order) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.56),
      new THREE.MeshBasicMaterial({
        map, color: tint, transparent: true, opacity: 0, depthWrite: false,
        side: THREE.DoubleSide, blending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = order;
    seal.add(m);
    return m;
  };
  const body = face(sealTex('attach-seal-body', false), 0x140d07, THREE.NormalBlending, 30);
  // Washed toward white. At the faction's own value the ring sat on a
  // near-black lozenge on a warm card and read as a dark hole in the band
  // rather than as a fastening catching the light.
  const hot = colour.clone().lerp(new THREE.Color(0xffffff), 0.16);
  const rim = face(sealTex('attach-seal-rim', true), hot, THREE.AdditiveBlending, 31);

  kit.hold(seal, A.TOTAL, (t) => {
    const s = t * A.TOTAL;
    if (s < A.CINCH - 0.06) { seal.visible = false; return; }
    seal.visible = true;
    // struck, not faded in: it lands oversized and snaps down onto the band
    const set = clamp01((s - (A.CINCH - 0.06)) / 0.16);
    seal.scale.setScalar(1.55 - 0.55 * easeOut(set));
    // The seal outlasts the cloth. It starts fading a beat after the band
    // does and is the last thing on screen, which is the whole difference
    // between this motif and one that clears.
    const out = s > A.HOLD + 0.12
      ? Math.max(0, 1 - (s - A.HOLD - 0.12) / (A.TOTAL - A.HOLD - 0.12)) : 1;
    body.material.opacity = 0.9 * set * out;
    // Struck white-hot and then a steady ember. The flare is taken off the
    // clock and not off `set`, because multiplying a rising flare by a rising
    // fade-in cancels it out — the first version's strike peaked at a fifth of
    // its intended brightness and nobody would have known it was there.
    const strike = Math.max(0, 1 - Math.abs(s - (A.CINCH + 0.04)) / 0.18) ** 2;
    rim.material.opacity = (0.66 + 0.70 * strike) * set * out;
  });

  /* --- the fighter takes it. A short shudder as the band pulls in; enough to
     say the thing is fastened ONTO something and not floating over it. */
  const held = A.CINCH + 0.34;
  kit.hold(new THREE.Object3D(), held, (t) => {
    const s = t * held;
    const p = kit.piece(host.card?.uid) || host;
    if (s < A.BIND) return;
    // set every tick, not once: the board's own move tween clears this flag
    // when it ends and the card snapped home mid-shudder
    p.animating = true;
    const k = s - A.BIND;
    p.group.position.copy(anchor);
    p.group.position.y -= 0.035 * Math.exp(-k * 6) * Math.cos(k * 17);
  }, () => {
    const p = kit.piece(host.card?.uid) || host;
    p.group.position.copy(restOf(p));
    p.animating = false;
  });

  /* --- motes shaken out of the weave as it goes tight. They are BORN ON THE
     BAND and lift off it, rather than bursting from the card's centre: a ring
     of sparks around a fighter is what half this set does when something is
     destroyed, and nothing is being destroyed here. */
  const MOTES = 9;
  const motes = new THREE.Group();
  const from = [], drift = [];
  for (let i = 0; i < MOTES; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: motePuff(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: colour,
    }));
    const m = (Math.random() - 0.5) * 2 * R * 0.95;
    from.push(seat(m, new THREE.Vector3(), 1).clone()
      .add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.02,
        (Math.random() - 0.5) * 0.12)));
    drift.push(new THREE.Vector3((Math.random() - 0.5) * 0.35,
      0.45 + Math.random() * 0.4, (Math.random() - 0.5) * 0.35));
    sp.position.copy(from[i]);
    sp.scale.setScalar(0.15);
    motes.add(sp);
  }
  kit.hold(motes, A.TOTAL, (t) => {
    const k = (t * A.TOTAL - (A.CINCH - 0.04)) / 0.55;
    motes.visible = k > 0 && k < 1;
    if (!motes.visible) return;
    for (let i = 0; i < motes.children.length; i++) {
      const sp = motes.children[i];
      sp.position.copy(from[i]).addScaledVector(drift[i], k);
      sp.material.opacity = 0.85 * (1 - k) ** 1.5 * Math.min(1, k * 8);
      sp.scale.setScalar(0.15 * (1 - k * 0.4));
    }
  });

  /* --- and the light of it. HEIGHT, not power: a point light falls off as
     1/d^2 with a floor of 0.01, so one sitting a few centimetres over the card
     face is multiplied by a hundred and burns a white hole through the art at
     the exact moment the band and the seal have to be told apart. A card's
     width up, the same light is a pool. */
  const lamp = new THREE.PointLight(look.spark, 0, 4, 2);   // 6.5 washed the art flat
  lamp.position.set(anchor.x, anchor.y + 0.95, anchor.z);
  kit.hold(lamp, A.TOTAL, (t) => {
    const s = t * A.TOTAL;
    const k = (s - A.CINCH + 0.06) / 0.3;
    lamp.intensity = k <= 0 || k >= 1 ? 0 : 4.4 * (1 - k) * Math.min(1, k * 6);
  });
}
