// THE BULWARK — a fighter braces, and for a moment it is harder than it looks.
//
// Shared by 2 cards: A007 Threadbearer ("if you have fewer cards in your hand
// than each opponent, +II when Attacking and +I when being Attacked") and A066
// Swarmseeker, whose power rises to the size of the biggest enemy stack beside
// it. Both are CONDITIONAL strength — nothing is spent and nothing is gained
// permanently; a threshold is crossed and the fighter is simply worth more
// while it holds.
//
// HARDENING, NOT GROWING. Everything that means "more" on a table reaches
// outward — a ring expanding, a card rising, light thrown off. All of that is
// the wrong sentence here, because a conditional bonus does not make a fighter
// BIGGER, it makes it harder to get at. So this moves inward and downward: a
// chamfered band closes onto the card from outside it, overshoots, seats, and
// the fighter settles a couple of centimetres INTO the stone under the weight
// of it. Nothing in the motif ever gets larger than the card.
//
// THE NUMBER IS NOT THIS FILE'S JOB. ../../textures.js already draws a +I or
// -II badge on the corner of any fighter whose power differs from what is
// printed, and it is drawn for as long as the bonus lasts. Saying it a second
// time in light would be a second, contradictory source of truth — this shows
// the FEELING of the threshold being crossed and nothing else.
//
// IT TAKES THE FACTION'S COLOUR, because it is shared by an Auroxi card and a
// Gloaming one and those two look nothing alike. But only the GLINT is ever in
// the faction's bright colour: the band itself is that hue at an eighth of its
// value, so what sits on the board for half a second is a dark chamfered edge
// with a lit lip, and not a coloured slab. One agent's claws at nearly four
// times the emissive ./shardfire.js settled on came out as flat saturated
// lozenges whatever the light did.
//
// The power badge is safe from all of it: ../../pieces.js hangs those sprites
// at renderOrder 1001 with depthTest off, so a +II sits ON the band rather
// than under it however the band is scaled.
//
// WHY IT IS A FRAME AND NOT FOUR PLATES. Four bars sliding in and mitring at
// the corners is the same picture and four times the code, and at 60 pixels a
// card the mitres are two pixels wide — an absent detail. One band painted
// once, closing by scale, is perfectly mitred for free and can be given proper
// corner brackets in the canvas where they will actually be seen.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=220" \
//             --eval tools/fxdemo/bulwark.js --out /tmp/bulwark-220.png \
//             --wait 8000 --settle 500
// ?t is milliseconds INTO the motif, ?faction=Auroxi|Gloaming switches the
// colour, ?me is the square and ?zoom drops the camera in.

import { THREE, FACTION, CARD_W, CARD_H } from '../kit.js';

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. It is short: this fires off
// a CONSTANT ability, so it can go off several times in a turn as hands and
// stacks change, and a long effect on a frequent trigger is noise.
const SPAN = 1.15;
const SHUT = 0.12;        // the band closes onto the card
const SEAT = 0.2;         // ...overshoots and seats
const HOLD = 0.6;         // it is simply there
const OFF = 1.0;          // and it comes off

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials and a material
// never disposes its map, so a canvas built per cast leaks a GPU upload every
// time a condition flickers on.
const TEX = new Map();
function tex(key, paint, w, h) {
  let t = TEX.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEX.set(key, t);
  }
  return t;
}

/** A chamfered rectangle path, inset by `m` from the canvas edge. */
function chamfer(g, W, H, m, cut) {
  g.beginPath();
  g.moveTo(m + cut, m);
  g.lineTo(W - m - cut, m);
  g.lineTo(W - m, m + cut);
  g.lineTo(W - m, H - m - cut);
  g.lineTo(W - m - cut, H - m);
  g.lineTo(m + cut, H - m);
  g.lineTo(m, H - m - cut);
  g.lineTo(m, m + cut);
  g.closePath();
}

/**
 * The band: a chamfered edge with a lit inner lip, heavier at the corners.
 *
 * Painted white and tinted by the material, because the whole band is one
 * value ramp and a tint can carry that. The corners are the only part drawn
 * separately: a band of even thickness is a picture frame, and BRACKETS at the
 * corners are what make it a thing that has been clamped on.
 */
const bandTex = () => tex('band', (g, W, H) => {
  g.clearRect(0, 0, W, H);
  const cut = W * 0.13;
  // The body of the band, between two chamfered outlines. Drawn as a filled
  // outer shape with the inner one punched out, so the corners mitre by
  // construction rather than by four bars overlapping.
  // The body is painted GREY and not white. A band that is all one value in
  // the canvas has only the material tint to carry it, so the lit lip and the
  // body come out the same colour and the whole thing is a flat coloured
  // rectangle round the card — a selection cursor. Two values in the map and a
  // dark tint over them gives a dark edge with a lighter lip, which is the
  // only thing that makes it read as a chamfer.
  g.fillStyle = 'rgba(132,132,132,0.92)';
  chamfer(g, W, H, W * 0.035, cut);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(255,255,255,1)';
  chamfer(g, W, H, W * 0.115, cut * 0.76);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  // The lit lip, just inside the band. This is the only bright line in the
  // motif and it is one and a half canvas pixels at the size this is drawn —
  // any thinner and it is a sub-pixel detail, which is an absent detail.
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = W * 0.016;
  chamfer(g, W, H, W * 0.1, cut * 0.8);
  g.stroke();
  // Corner brackets: short heavy returns at the four corners, which is what
  // says clamped rather than framed.
  g.lineCap = 'butt';
  g.lineWidth = W * 0.052;
  g.strokeStyle = 'rgba(206,206,206,0.95)';
  const a = W * 0.075, b = W * 0.30;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const cx = sx > 0 ? a : W - a, cy = sy > 0 ? a : H - a;
    g.beginPath();
    g.moveTo(cx + sx * b * 0.1, cy + sy * b);
    g.lineTo(cx + sx * b * 0.1, cy + sy * b * 0.1);
    g.lineTo(cx + sx * b, cy + sy * b * 0.1);
    g.stroke();
  }
  // ...and the outer edge falls off rather than stopping, so the band is a
  // chamfer and not a sticker.
  g.globalCompositeOperation = 'destination-out';
  g.lineWidth = W * 0.05;
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  chamfer(g, W, H, W * 0.012, cut * 1.1);
  g.stroke();
  g.globalCompositeOperation = 'source-over';
}, 256, 256);

/** A soft dark blot: the card's own weight, on the stone under it. */
const weightTex = () => tex('weight', (g, W) => {
  const grd = g.createRadialGradient(W / 2, W / 2, W * 0.16, W / 2, W / 2, W * 0.5);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
}, 96, 96);

/* ------------------------------------------------------------------ main */

export function bulwark(kit, at, faction) {
  const piece = kit.piece(at);
  const p = kit.at(at);
  if (!p) return;

  const look = FACTION[faction] || FACTION.Neutral;
  const spark = new THREE.Color(look.spark);
  // The band is the faction's own hue at an eighth of its value, and the
  // eighth is not a guess: THREE.Color converts a hex from sRGB to linear on
  // the way in and MeshBasicMaterial uses it linear, so a multiplier of 0.2
  // comes back out at about sRGB 0.48 — a mid gold, which is what the first
  // pass put round the card and which at this size is a selection highlight.
  // 0.13 lands at about sRGB 0.39 for the lip and 0.29 for the body.
  const body = spark.clone().multiplyScalar(0.13);

  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);

  // Flat work sits 0.055 clear of whatever it lies on: a card face is at about
  // 0.21 and the flagstone at 0.080, and at less the depth test (gl.LESS fails
  // on equal) drops a decal on the stone AROUND the card and not on it. The
  // band overlaps the card's edge, so it is measured off the face.
  const FACE = 0.21 + 0.055;
  const GROUND = 0.08 + 0.055;

  // The band is a hair larger than the card, so its lit lip lands just inside
  // the card's own border and its body sits on the stone beyond it — clamped
  // ON, rather than floating around.
  const W = CARD_W * 1.2, H = CARD_H * 1.2;
  const band = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({
    map: bandTex(), transparent: true, depthWrite: false, opacity: 0,
  }));
  band.material.color.copy(body);
  band.rotation.x = -Math.PI / 2;
  band.renderOrder = 4;
  band.position.y = FACE;
  g.add(band);

  // The glint: the same band again, in the faction's bright colour, for a
  // tenth of a second at the moment it seats. It is a separate object and not
  // a brightening of the first because it has to come and go on its own clock
  // — the band is there for half a second and the glint is the FRAME it lands
  // on, and nothing says "hard" like a highlight that is gone before you have
  // looked at it.
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({
    map: bandTex(), transparent: true, depthWrite: false, opacity: 0,
  }));
  glint.material.color.copy(spark);
  glint.rotation.x = -Math.PI / 2;
  glint.renderOrder = 5;
  glint.position.y = FACE + 0.004;
  g.add(glint);

  // What the fighter's new weight does to the stone. This is where the
  // contrast comes from — against lit flagstone a dark patch is the most
  // legible mark this table has — and it is the only part of the motif that
  // can be strong without sitting on anyone's art, because a card stands in
  // front of it.
  const weight = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.75, CARD_H * 1.75),
    new THREE.MeshBasicMaterial({
      map: weightTex(), color: 0x0a0806, transparent: true, depthWrite: false, opacity: 0,
    }));
  weight.rotation.x = -Math.PI / 2;
  weight.renderOrder = 2;
  weight.position.y = GROUND;
  g.add(weight);

  const home = piece ? piece.group.position.clone() : null;
  let held = null, lost = false;

  kit.hold(g, SPAN, (t) => {
    // It CLOSES: from a fifth wider than the card down onto it, overshooting
    // inside its own resting size and settling back out. Opening outward was
    // the first cut and it is the wrong sentence entirely — a ring leaving a
    // card is the card giving something off, and this fighter is not giving
    // anything off, it is shutting.
    const shut = smooth(t / SHUT);
    const seat = smooth((t - SHUT) / (SEAT - SHUT));
    const s = 1.22 - 0.26 * shut + 0.04 * seat;
    band.scale.set(s, s, 1);

    const off = smooth((t - HOLD) / (OFF - HOLD));
    band.material.opacity = (0.35 + 0.6 * shut) * (1 - off);

    // The glint lives entirely inside the seat — up in two frames, gone in
    // six. Held any longer it stops being a highlight and becomes a coloured
    // outline round the card, which is what a selection cursor looks like.
    const flash = clamp01((t - SHUT * 0.86) / 0.022) * (1 - smooth((t - SHUT) / 0.1));
    glint.material.opacity = 0.52 * flash;
    glint.scale.set(s, s, 1);

    weight.material.opacity = 0.5 * shut * (1 - off);
    // The dark under it tightens as the band seats: a shadow that stays the
    // same size while something clamps shut above it is a decal.
    const ws = 1.1 - 0.16 * shut;
    weight.scale.set(ws, ws, 1);

    // The fighter PRESSES DOWN. Two and a half centimetres, which is under a
    // pixel of movement and is still the right amount: what reads is not the
    // distance but the fact that it goes the other way from every other
    // effect on this table.
    if (piece && home && piece.group.parent && !lost) {
      // Only while nothing else has taken the card. This fires off a CONSTANT
      // ability, so it can go off while the fighter is being attacked or
      // shoved by something else, and two owners of one transform is a card
      // that jitters between them — and then gets handed back to the wrong
      // place by whichever of them finishes last.
      if (held !== null && Math.abs(piece.group.position.y - held) > 1e-4) {
        lost = true;
      } else {
        piece.animating = true;
        held = home.y - 0.025 * shut * (1 - off);
        piece.group.position.y = held;
      }
    }
  }, () => {
    if (piece && home && piece.group.parent && !lost) {
      piece.group.position.copy(home);
      piece.animating = false;
    }
  });
}
