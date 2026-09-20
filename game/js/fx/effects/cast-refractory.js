// THE REFRACTORY FLOURISH — inquisitors — gold and white, a shaft of judgement from above.
//
// What a Refractory card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// The shape has to be a SHAFT, not a puff in gold: Gloaming sinks, Shardsworn
// comes apart, Marvorren ripples, Auroxi weaves, and the only one of the five
// with a DIRECTION from off-table is this one. So the whole motif is vertical
// and square-on: a rectangular shaft the size of the card comes straight down,
// a seal shuts onto the card edge, and it is spent. Nothing here expands
// outward and nothing drifts sideways — that is other factions' business.
//
// Every part of it is built up front and driven off `t` rather than scheduled
// along the way. It is one hold, so there is one place to read the timing and
// nothing can be left behind on the table if a frame is slow.
//
// One effect, one file.
//
// Preview — ?at is milliseconds INTO the motif, which is the only honest way
// to look at it; headless frames are far too slow for wall-clock --settle to
// land where you think:
//
//   node tools/shot.js --url "game/?quick=1&seed=5&at=150" \
//     --eval tools/fxdemo/cast-refractory.js --out /tmp/cr.png --settle 300

import { THREE, FACTION, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';

/**
 * Textures, kept for the life of the page. This fires on nearly every
 * Refractory card, and building a fresh canvas and uploading it each time was
 * churn for two pictures that never change. kit.hold disposes materials but
 * never their maps, so these outlive every cast.
 */
const TEX = new Map();
function tex(key, paint, size = 128) {
  let t = TEX.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEX.set(key, t);
  }
  return t;
}

/** A speck of dust in the beam. */
const speck = () => tex('speck', (g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(255,235,185,1)');
  grd.addColorStop(1, 'rgba(255,225,150,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, n, n);
});

/**
 * The light on the card: a SQUARE plateau with feathered edges, not a round
 * blob. The blob the kit hands out is the giveaway that a pool of light was
 * dropped on the card by a sprite — every faction's puff is that same circle.
 * A shaft with a square footprint has to land as a square, so this is one
 * falloff profile applied across and again down, which multiplies out to a
 * square-cornered patch that peaks in the middle. It PEAKS rather than sitting
 * flat: the first profile held a plateau across the whole card and the strike
 * simply erased the art underneath it, which is the one thing this effect is
 * not allowed to do — it marks the card, it does not replace it.
 */
const plate = () => tex('plate', (g, n) => {
  const ramp = (grd) => {
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const k = Math.sin(Math.PI * u) ** 0.9;
      grd.addColorStop(u, `rgba(255,255,255,${k})`);
    }
    return grd;
  };
  g.fillStyle = ramp(g.createLinearGradient(0, 0, n, 0));
  g.fillRect(0, 0, n, n);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = ramp(g.createLinearGradient(0, 0, 0, n));
  g.fillRect(0, 0, n, n);
}, 256);

/**
 * Where the flat parts lie. `kit.at` answers 0.4 for a bare square but about
 * 0.2 for a card, whose face is at ~0.22 — so anything drawn at the raw height
 * either floats above an empty square or sinks into an occupied one.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.03;

const HALF_W = CARD_W * 0.5;   // cards are 1.74 x 1.76 — square enough to treat as one

/**
 * The walls of a rectangular shaft, hung from its top edge: y runs 0 to -h, so
 * scaling the parent in y drives the FOOT of the shaft down toward the board
 * while the top stays put. That is the descent.
 *
 * Vertex colours carry the light. Vertically it fades to nothing at the top,
 * because a shaft has to leave the frame without a rim — a wall that ends at
 * full brightness is a box, not a beam. Horizontally each wall is bright down
 * its middle and dark at the corners, which was the fix for the first version:
 * four flat quads at even brightness read as a folded paper lantern, with two
 * hard vertical creases straight down the picture. Dimming the corners rounds
 * the silhouette off while the FOOTPRINT stays square, and the square
 * footprint is the whole point.
 */
function shaftWalls(top, bot, h, cols = 7, rows = 4) {
  const T = [[-top, -top], [top, -top], [top, top], [-top, top]];
  const B = [[-bot, -bot], [bot, -bot], [bot, bot], [-bot, bot]];
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  // v runs 0 at the top to 1 at the foot. It brightens down the beam and then
  // BACKS OFF over the last stretch, so the wall does not put a hard bright
  // band across the card where it meets it. With the wall at full brightness
  // right down to the floor the strike wiped the middle of the card out, and
  // the light in the air is meant to be the reason you look AT the card.
  const down = (v) => v ** 1.25 * (1 - 0.5 * Math.max(0, (v - 0.84) / 0.16) ** 1.4);
  const across = (u) => 0.12 + Math.sin(Math.PI * u) ** 0.8 * 0.88;
  const pos = [];
  const col = [];
  for (let w = 0; w < 4; w++) {
    const n = (w + 1) % 4;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const corner = (ci, ri) => {
          const u = (c + ci) / cols;
          const v = (r + ri) / rows;
          const a = lerp(T[w], T[n], u);
          const b = lerp(B[w], B[n], u);
          const q = lerp(a, b, v);
          const k = across(u) * down(v);
          pos.push(q[0], -h * v, q[1]);
          col.push(k, k, k);
        };
        corner(0, 0); corner(0, 1); corner(1, 1);
        corner(0, 0); corner(1, 1); corner(1, 0);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/** A square outline lying flat — the seal, in the card's own shape. */
function frame(half, thick) {
  const s = new THREE.Shape();
  s.moveTo(-half, -half); s.lineTo(half, -half); s.lineTo(half, half);
  s.lineTo(-half, half); s.closePath();
  const i = half - thick;
  const hole = new THREE.Path();
  hole.moveTo(-i, -i); hole.lineTo(i, -i); hole.lineTo(i, i); hole.lineTo(-i, i);
  hole.closePath();
  s.holes.push(hole);
  const geo = new THREE.ShapeGeometry(s);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Fall, hold, fade — as fractions of SPAN. The animator holds the UI while any
// of this is running and a Refractory player sees it forty times in a game, so
// the whole budget is six tenths of a second: 0.14s of descent, 0.16s standing
// on the card, and the rest dying.
//
// The HOLD is not padding. Without it the shaft was at full length for about
// two frames before it began to fade, and every screenshot through the middle
// of the motif showed a glow on a card and no beam at all — the one thing that
// makes this Refractory rather than a generic gold puff never got seen.
const SPAN = 0.62;
const STRIKE = 0.23;
const HOLD = 0.48;

// How far up the shaft starts. The first pass hung it 2.6 units up, which from
// this camera put the top of the beam most of the way to the top of the screen
// and blotted out the square behind the card — on the effect that fires more
// often than any other. A short shaft reads as light through a window; a tall
// one reads as weather.
const H = 1.4;

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION.Refractory || FACTION.Neutral;
  const y = flatY(p);

  const g = new THREE.Group();
  g.position.copy(p).setY(y);

  // Two shafts rather than one: the wide one is the light in the air, the
  // tight one is its core. A single shaft at an opacity you can see through is
  // a sheet, and at one you cannot is a pillar of chalk.
  //
  // The walls are nearly PARALLEL — 1.14 of a card half down to 0.92 — because
  // the cone of the earlier attempt spread wide enough at the top to read as a
  // searchlight pointing the other way. Light through a high window arrives in
  // a column, and a column also keeps the motif inside the card's own square.
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffc86a, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffe3a8, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const blades = new THREE.Group();
  blades.position.y = H;
  blades.add(new THREE.Mesh(shaftWalls(HALF_W * 1.14, HALF_W * 0.92, H), shaftMat));
  blades.add(new THREE.Mesh(shaftWalls(HALF_W * 0.5, HALF_W * 0.36, H, 5), coreMat));
  g.add(blades);

  // Dust caught in the beam. Without it the shaft is a decal on the sky; with
  // it the light is coming from somewhere, which is the whole motif.
  const dust = [];
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Sprite(new THREE.SpriteMaterial({
      map: speck(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    d.userData = {
      x: (Math.random() - 0.5) * CARD_W * 0.8,
      z: (Math.random() - 0.5) * CARD_H * 0.8,
      off: Math.random(), size: 0.1 + Math.random() * 0.07,
    };
    dust.push(d);
    g.add(d);
  }

  // The light on the card face — a square of it, the shaft's own footprint.
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.3, CARD_H * 1.3),
    new THREE.MeshBasicMaterial({
      map: plate(), color: 0xffb84c, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  g.add(pool);

  // THE SEAL — a square outline that rides the foot of the shaft DOWN and
  // stamps the card, shrinking onto its edge as it comes.
  //
  // This is the thing that carries the motif. A shaft on its own, at any
  // opacity that did not wash the whole square out, was barely legible against
  // lit stone: soft additive gold over a warm brazier-lit floor is nearly the
  // floor's own colour. The seal is hard-edged, so it reads at any brightness,
  // it gives the descent something you can actually watch travel, and a
  // square being pressed onto a card is a verdict in a way that no amount of
  // glow is. Everything else on this table opens outward; this one shuts.
  const seal = new THREE.Mesh(frame(1, 0.095), new THREE.MeshBasicMaterial({
    color: 0xffbe52, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  g.add(seal);

  // The inner rule. A single line is a highlight; two concentric lines are a
  // STAMP, and that one extra line is most of what makes the landing read as
  // a document being sealed rather than a card being selected. It only exists
  // after the hit, so the descent stays a single clean square.
  const rule = new THREE.Mesh(frame(0.8, 0.062), new THREE.MeshBasicMaterial({
    color: 0xffbe52, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  seal.add(rule);

  const lamp = new THREE.PointLight(look.spark, 0, 4.5, 2);
  lamp.position.y = 0.9;
  g.add(lamp);

  kit.hold(g, SPAN, (t) => {
    const fall = Math.min(1, t / STRIKE);
    const after = Math.max(0, t - HOLD) / (1 - HOLD);
    const since = Math.min(1, Math.max(0, t - STRIKE) / 0.08);   // 0 at the hit

    // The beam itself arrives ALL AT ONCE — two frames and it is full length.
    // Growing it downward over the whole descent was the wrong picture twice
    // over: light does not extend like a tentacle, and while it was growing
    // there was nothing in the air above the seal, so for the first half of
    // the motif a gold frame floated down on its own with no beam around it.
    // The descent is the SEAL's job; the shaft is simply there.
    blades.scale.y = easeOut(Math.min(1, t / 0.07));
    blades.scale.x = blades.scale.z = 1 - after * 0.45;
    // and it is SPENT by the strike: a shaft that lingers reads as smoke
    // coming off the card rather than light coming down onto it
    const life = (1 - after) ** 2.2;
    shaftMat.opacity = (0.09 + fall * 0.24) * life;
    coreMat.opacity = (0.03 + fall * 0.42) * life;

    for (const d of dust) {
      const u = d.userData;
      const k = (t * 1.5 + u.off) % 1;
      d.position.set(u.x, H * (1 - k) * blades.scale.y + 0.05, u.z);
      d.scale.setScalar(u.size);
      d.material.opacity = 0.5 * Math.sin(Math.PI * k) * (1 - easeIn(t));
    }

    // The seal comes down and lands on the beat. Two things make the landing
    // an event rather than a fade: the opacity JUMPS at STRIKE — smoothing it
    // across the strike took all the authority out of the motif — and it bites
    // a little inside the card edge before springing back out over two frames.
    // Without the overshoot the arrival was smooth, and a smooth arrival has
    // no impact in it at all. This is a stamp coming down.
    const shut = easeIn(fall);
    seal.scale.setScalar(HALF_W * (1.42 - shut * 0.42 - 0.035 * (1 - since) ** 2));
    seal.position.y = H * (1 - shut) + 0.006;
    seal.material.opacity = t < STRIKE
      ? (0.22 + fall * 0.3) * Math.min(1, t / 0.05)      // no pop on frame one
      : (0.75 + 0.4 * (1 - since) ** 2) * (1 - after) ** 1.3;
    rule.material.opacity = t < STRIKE ? 0 : 0.5 * (1 - after) ** 1.5;

    // The strike on the card face, deliberately weak and short. At the
    // brightness this first ran at, the card under it went to flat white for a
    // third of a second — the flourish ate the card it was there to point at.
    pool.material.opacity = t < STRIKE
      ? 0.1 * fall * fall
      : (0.12 + 0.2 * (1 - since) ** 1.5) * (1 - after) ** 1.4;
    pool.scale.setScalar(t < STRIKE ? 0.72 : 0.72 + easeOut(after) * 0.2);
    lamp.intensity = t < STRIKE ? 0 : 4.5 * (1 - since) ** 1.6 * (1 - after);
  });
}
