// LASH OUT — something reaches out and kills at a distance.
//
// Shared by 3 cards: M004 Capricorn Cavalry (a lash on arrival, next door),
// M079 Khosari Cannoneer (artillery, two squares) and C050 Elven Ranger (a
// bowshot, up to four). One motif, one file.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=200" \
//             --eval tools/fxdemo/lashout.js --out /tmp/l.png --settle 1400
// `t` is the point in the MOTIF to freeze at, in milliseconds; the harness
// steps the animator by hand, because wall-clock --settle lands wherever the
// headless frame rate feels like on the day and this motif is over in 200ms.
//
// The whole job is REACH: two squares that had nothing to do with each other
// are joined by a line, and the far one dies. So the thing that has to survive
// at 60 pixels a card is the LINE, not the bang — which is the opposite of a
// barrage, and drives every decision here:
//
//   ONE lance, not a burst. Barrage (volley.js) already owns many small rounds
//     leaving one fighter, and its material is gold beads with muzzle cones.
//     Nothing here is repeated, nothing is gold, and there is no cone.
//   THE LINE OUTLIVES THE SHOT. A projectile that crosses two squares in 75ms
//     is four frames of screen time and simply is not seen. So the lance
//     leaves a straight afterimage standing between the two squares for a
//     third of a second, and that streak — not the flight — is the motif.
//   IT DIES FROM THE SHOOTER'S END. The afterimage is eaten away from the
//     muzzle forward, so the last thing left on screen is the span nearest the
//     victim and the eye is handed to the kill. Fading it evenly just dimmed
//     the whole line and the read went nowhere.
//   THE FORCE CARRIES ON THROUGH. The crack on the victim's card, the debris
//     and the way the card LEAVES all point away from the shooter, along the
//     same line. A hit that throws things evenly has no shooter in it.
//   THE SHOOTER LEANS IN. It is a lash, not a gun: the card loads back on the
//     draw, throws forward as the lance goes, and rocks home. Barrage knocks
//     its shooter backwards, and doing both the same way made them one effect.
//
// WHO IS BEING SHOT AT is not in the event — the motif is handed the shooter
// and nothing else — and getting it wrong is not survivable here, because a
// line is an accusation: it points at one card, and if a different card dies
// the whole table is a lie. So the motif does not guess when it does not have
// to. It is built in two halves that meet in the middle:
//
//   lashout()  plays the DRAW only — the fighter gathers, and nothing has a
//              direction yet. It declares `timing.kill` so the board holds the
//              victim on the table for exactly that long.
//   exit()     is handed the card that actually died, by name, the moment the
//              draw ends. THAT is where the lance is loosed, and the same
//              motion that lands it carries the card away.
//
// The two are matched by `awaiting` below. If nothing dies — the ability
// fizzled, or the motif is being browsed in the effects lab — the draw fires
// the lance itself, at the best square it can work out, so the motif is never
// just a card twitching.

import { THREE, FACTION, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { STEP } from '../../arena.js';

/* ------------------------------------------------------------- materials */

/** Soft sprite maps kept by colour: kit.hold disposes materials, never maps. */
const blobs = new Map();
function blob(inner, outer) {
  const key = `${inner}|${outer}`;
  let t = blobs.get(key);
  if (!t) { t = blobTexture(inner, outer); blobs.set(key, t); }
  return t;
}
const alpha = (rgba, a) => rgba.replace(/[\d.]+\)$/, `${a})`);

function mote(glow, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blob(glow, alpha(glow, 0)), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0,
  }));
  s.scale.setScalar(size);
  return s;
}

/**
 * Where the flat parts lie. `kit.at` answers 0.4 for a bare square but about
 * 0.21 for a card face. Less than 0.055 of clearance over a face loses the
 * depth test and the mark is drawn on the stone AROUND the card instead of on
 * it, which is how the first crack came out as a hole in the flagstone.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;

const CORE = 'rgba(255,250,238,1)';   // the filament itself: always white-hot

/**
 * The lance, as a chain of samples turned into two CROSSED quad strips — one
 * flat, one upright. A single flat ribbon vanished whenever the shot ran
 * toward or away from the camera, which is half the shots on this board; a
 * sprite trail had no direction in it at all at this camera height and read as
 * a smear of beads. Crossed strips keep their line whichever way they point.
 *
 * Per-vertex RGBA, because the brightness along the lance is the whole
 * character of it — hot at the head, cold at the tail, and eaten away from the
 * tail end afterwards.
 */
function cord(n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4 * 4), 4));
  const idx = [];
  for (let plane = 0; plane < 2; plane++) {
    const base = plane * n * 2;
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;

  const pos = geo.attributes.position.array;
  const col = geo.attributes.color.array;
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /** `pts` are world points; `shape(i)` answers [halfWidth, brightness, alpha]. */
  const lay = (pts, shape) => {
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      tan.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]);
      if (tan.lengthSq() < 1e-9) tan.set(1, 0, 0);
      tan.normalize();
      side.crossVectors(tan, UP);
      if (side.lengthSq() < 1e-9) side.set(0, 0, 1);
      side.normalize();
      const [w, b, a] = shape(i);
      const f = i * 6, u = n * 6 + i * 6;
      pos[f] = p.x - side.x * w; pos[f + 1] = p.y; pos[f + 2] = p.z - side.z * w;
      pos[f + 3] = p.x + side.x * w; pos[f + 4] = p.y; pos[f + 5] = p.z + side.z * w;
      // The upright strip is kept narrower: seen from this camera it is mostly
      // edge-on, and at equal width it doubled the apparent thickness of a
      // shot running left to right while adding nothing to one running away.
      const h = w * 0.62;
      pos[u] = p.x; pos[u + 1] = p.y - h; pos[u + 2] = p.z;
      pos[u + 3] = p.x; pos[u + 4] = p.y + h; pos[u + 5] = p.z;
      for (const v of [i * 4, n * 4 + i * 4]) {
        col[v] = b; col[v + 1] = b; col[v + 2] = b; col[v + 3] = a;
        col[v + 4] = b; col[v + 5] = b; col[v + 6] = b; col[v + 7] = a;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };

  return { mesh, lay, tint: (c) => mesh.material.color.copy(c) };
}

/**
 * The crack the shot leaves on the victim's card: thin flat slivers radiating
 * from the hit, built once at unit size and scaled. It lies FLAT because the
 * camera is nearly overhead — an upright star at this angle is a few pixels
 * tall and reads as a smudge, while a flat one is a shape.
 *
 * `bias` weights the arms along +Z (the shot's own direction once the mesh is
 * aimed), so the crack has the shot in it rather than being a snowflake.
 */
function crack(seed) {
  const pos = [], col = [], idx = [];
  const arms = 7;
  for (let i = 0; i < arms; i++) {
    // Jittered in angle as well as length. Evenly spaced arms of similar
    // length are a SPARKLE — the twinkle a jewel gets in a cartoon — and a
    // sparkle on the card of a fighter being killed is the wrong idea
    // entirely. Uneven spacing and one or two stunted arms read as a break.
    const jog = ((i * 9301 + 49297) % 233) / 233 - 0.5;
    const a = (i / arms) * Math.PI * 2 + seed + jog * 0.55;
    const bias = 0.42 + 0.58 * (0.5 + 0.5 * Math.cos(a));   // longest going on
    const len = bias * (0.6 + ((i * 7919) % 100) / 90);
    // Each arm is a sliver spanning the hub SYMMETRICALLY and running out to a
    // point. The first pass hung its base off one side of centre, which built
    // a pinwheel rather than a star, and at a base of 0.03 the slivers were
    // under a pixel wide at the size this is played at — the crack was there
    // in the scene graph and invisible on the screen.
    const w = 0.085 * bias;
    const base = pos.length / 3;
    const px = Math.cos(a) * w, pz = -Math.sin(a) * w;
    pos.push(-px, 0, -pz, px, 0, pz, Math.sin(a) * len, 0, Math.cos(a) * len);
    col.push(1, 1, 1, 0.9, 1, 1, 1, 0.9, 1, 1, 1, 0);
    idx.push(base, base + 1, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * The shock across the victim's card: a ring, but not a DRAWN one. A perfect
 * circle of even brightness on a card face is a piece of interface — the board
 * already uses exact rings for landings, clashes and deaths — so this one is
 * cut with a ragged radius and weighted FORWARD, brightest on the far side of
 * the card where the shot was still travelling. Built in its own xz plane so
 * `lookAt` can aim that weighting down the line.
 */
function blast(n = 48) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rag = 1 + 0.09 * Math.sin(a * 5.3 + 0.7) + 0.06 * Math.sin(a * 9.1 + 2.1);
    const ri = 0.74 * rag, ro = 0.86 * rag;
    pos.push(Math.sin(a) * ri, 0, Math.cos(a) * ri, Math.sin(a) * ro, 0, Math.cos(a) * ro);
    // cos(a) is +1 straight ahead of the shot once the mesh is aimed
    const w = 0.5 + 0.5 * (0.5 + 0.5 * Math.cos(a));
    col.push(1, 1, 1, w, 1, 1, 1, w * 0.55);
    if (i < n) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------ the victim */

/** Manhattan squares between two board indices — how the cards count range. */
function apart(a, b) {
  return Math.abs((a % 3) - (b % 3)) + Math.abs(Math.floor(a / 3) - Math.floor(b / 3));
}

/**
 * Who is PROBABLY being shot, for the fallback only — when nothing died and
 * the exit below is never going to be called. The enemy at the range these
 * three cards actually shoot at: two squares first, then anything out to four,
 * then anything at all. Never throws; answers null when the board holds no
 * enemies and the caller fires down the field instead.
 */
function victim(kit, me) {
  const all = kit.pieces?.byUid;
  if (!all || me?.square == null) return null;
  let best = null, bestScore = -1;
  for (const p of all.values()) {
    if (p === me || p.depth !== 0 || p.square == null) continue;
    if (p.square < 0 || p.square > 8) continue;
    if (me.owner != null && p.owner === me.owner) continue;
    const d = apart(me.square, p.square);
    if (d === 0) continue;
    const score = (d === 2 ? 30 : d <= 4 ? 20 - d : 5) - d * 0.01;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

/* -------------------------------------------------------------- the lash */

const AIM = 0.07;        // the draw, before anything leaves
const FLY = 0.075;       // time of flight, whatever the range
const GHOST = 0.36;      // how long the line stands after the shot
const HIT = 0.50;        // the kill at the far end
const SPAN = FLY + Math.max(GHOST, HIT) + 0.05;
const N = 40;            // samples along the lance

/**
 * How long the card the rules have just killed must stay on the table: the
 * length of the draw, because the exit below is what fires the lance and the
 * card has to still be standing there to be fired AT. It is measured to the
 * moment the lance LEAVES, not to the end of the animation — the flight and
 * the kill both happen inside the exit's own clock.
 */
export const timing = { kill: AIM };

/**
 * The handshake between the two halves. `lashout` leaves a token here; the
 * exit claims it. Still unclaimed when the draw ends means nothing died, and
 * the draw fires the lance itself.
 */
let awaiting = null;

export function lashout(kit, at, faction) {
  const a = kit.at(at);
  if (!a) return;
  const look = FACTION[faction] || FACTION.Neutral;
  const me = kit.piece(at);

  /* ---- the draw: it tightens, and it has no direction yet ---- */

  const g = new THREE.Group();
  // Over the fighter's own middle rather than out at the edge it will fire
  // from: at this point in the motif nobody — not even this file — knows which
  // way the shot is going, and a gather sitting on the wrong edge of the card
  // is a lie that the lance then contradicts 70ms later.
  const gather = mote(look.glow, 0.95);
  gather.position.copy(a).setY(flatY(a) + 0.22);
  g.add(gather);

  const lamp = new THREE.PointLight(look.spark, 0, 4.2, 2);
  lamp.position.copy(a).setY(flatY(a) + 0.7);
  g.add(lamp);

  kit.hold(g, AIM, (t) => {
    // It TIGHTENS: a wide soft glow drawn down to a point. Held at one size it
    // was a lamp sitting on the card and said nothing about a shot coming.
    gather.material.opacity = 0.95 * t ** 1.4;
    gather.scale.setScalar(1.05 - 0.62 * t);
    lamp.intensity = 4 * t ** 2;
  });

  // The fighter loads BACK against the shot it is about to throw. Skipped
  // outright if something else already owns the card — the Cavalry lashes
  // straight out of its own move tween, and two animations writing one
  // position is a card that jitters.
  if (!me?.animating && me?.restingPosition) {
    const home = me.restingPosition();
    const back = new THREE.Vector3(0, 0, me.owner === 1 ? -1 : 1);
    let held = null;
    kit.hold(new THREE.Object3D(), AIM, (t) => {
      const p = kit.piece(at);
      if (!p) return;
      p.animating = true;
      p.group.position.copy(home).addScaledVector(back, 0.06 * Math.sin(t * Math.PI));
      held = p.group.position.clone();
    }, () => {
      const p = kit.piece(at);
      if (p && held && p.group.position.distanceTo(held) < 1e-4) {
        p.group.position.copy(home);
        p.animating = false;
      }
    });
  }

  // The fallback, given 20ms of slack: when a card IS dying, the board's kill
  // tween was scheduled before this one and runs on the same animator, so the
  // exit always gets to claim the token first.
  const token = { at, claimed: false };
  awaiting = token;
  kit.after(AIM + 0.02, () => {
    if (token.claimed) return;
    const mark = victim(kit, me);
    strike(kit, at, look, mark, mark ? aimAt(mark) : blind(kit, me, a));
  });
}

/** Where a shot at this piece lands: the middle of the card it is standing on. */
function aimAt(piece) {
  return piece.restingPosition?.() || piece.group.position.clone();
}

/**
 * Nobody to shoot: fire two squares into enemy ground so the motif still reads
 * as reach. Row 0 is player 0's back row and row 2 is player 1's, so player 0
 * shoots at RISING row numbers. The sign was the other way round to begin with
 * and every unaimed shot went off behind the shooter.
 */
function blind(kit, me, a) {
  if (me?.square != null) {
    const row = Math.floor(me.square / 3);
    const step = me.owner === 1 ? -1 : 1;
    const to = row + step * 2 >= 0 && row + step * 2 <= 2 ? me.square + step * 6
      : row + step >= 0 && row + step <= 2 ? me.square + step * 3 : null;
    const p = to == null ? null : kit.at(to);
    if (p) return p;
  }
  return a.clone().add(new THREE.Vector3(0, 0, me?.owner === 1 ? STEP * 2 : -STEP * 2));
}

/**
 * The shot itself: the lance leaves the shooter, crosses the gap, and kills
 * what is at the far end. `mark` is the victim's piece when there is one, only
 * so the marks left on its card can ride it as it goes; everything else works
 * off `aim`, which is frozen here — chasing a card that is being thrown at the
 * discard pile walks the whole motif off the board after it.
 *
 * Answers the time of flight, so the caller can land the card's own reaction
 * on the same frame as the impact.
 */
function strike(kit, at, look, mark, aim) {
  const a = kit.at(at);
  if (!a || !aim) return FLY;

  const head = aim.clone().setY(flatY(aim) + 0.02);
  const stand = a.clone().setY(flatY(a) + 0.16);
  const dir = head.clone().sub(stand).setY(0);
  const range = dir.length();
  if (range < 0.2) return FLY;
  dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  // The lance leaves the EDGE of the card facing its victim. Fired from the
  // middle it erupted out of the shooter's own portrait and looked spawned.
  const muzzle = stand.clone().addScaledVector(dir, 0.82);

  const g = new THREE.Group();

  /* ---- the lance: a dim tinted halo with a white filament inside it ---- */

  // Two cords and not one strip with a gradient across it: a quad strip is two
  // vertices wide, so it cannot carry a core AND a flank. The halo is what
  // makes the line survive being drawn over lit card art; the filament is what
  // makes it hot.
  const halo = cord(N);
  const wick = cord(N);
  halo.tint(new THREE.Color(look.spark));
  wick.tint(new THREE.Color(0xffffff));
  g.add(halo.mesh, wick.mesh);

  const pts = [];
  for (let i = 0; i < N; i++) pts.push(new THREE.Vector3());

  // The whip in it while it is still going out. It is a LASH: the line arrives
  // bent and pulls straight, which a bullet does not do.
  const WHIP = 0.16 + range * 0.055;

  // Grain, one value a sample, fixed for the life of this shot. It is what the
  // line FRAYS along: a beam that simply dims is a laser pointer being turned
  // off, and that is what the afterimage looked like until every sample was
  // given its own rate to come apart at and its own small step sideways. What
  // is left after the shot should read as disturbed air, not as a bar.
  const grain = [];
  for (let i = 0; i < N; i++) grain.push([Math.random(), Math.random() - 0.5, Math.random() - 0.5]);

  const lay = (reach, bend, eat, wide, glow, fray = 0) => {
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const p = pts[i];
      p.copy(muzzle).lerp(head, u * reach);
      p.addScaledVector(side, Math.sin(u * 2.3 * Math.PI + 0.6) * (1 - u) * bend);
      p.y += Math.sin(Math.PI * u) * 0.10 * bend / Math.max(0.001, WHIP);
      // The fray never moves the two ENDS: the line has to keep hold of the
      // muzzle and the victim or it stops joining the two squares, which is
      // the only thing it is for.
      const hold = Math.sin(Math.PI * u) ** 0.5;
      p.addScaledVector(side, grain[i][1] * fray * 0.13 * hold);
      p.y += grain[i][2] * fray * 0.10 * hold;
    }
    const shape = (i) => {
      const u = i / (N - 1);
      // A lance is fattest just behind its point and thin at the tail. The
      // last two samples run to nothing so it ends in a POINT: cut square, the
      // head read as a brick sliding along a wire.
      const taper = u > 0.96 ? (1 - u) / 0.04 : 1;
      // Knotted as it comes apart: an even width all the way down is a drawn
      // rule, and the thing that stops the afterimage reading as a laser is
      // that it is LUMPY.
      const w = wide * (0.16 + 0.84 * u ** 1.7) * taper
        * (1 + fray * (grain[i][0] - 0.5) * 1.2);
      const cut = Math.min(1, Math.max(0, (u - eat) / 0.22))
        * Math.max(0, 1 - fray * (0.2 + grain[i][0] * 1.3));
      // Nothing here reaches 1. Additive white at full strength over lit card
      // art clips every channel, and the first pass came out as a white plank
      // laid between the squares with no colour and no filament in it.
      return [w, glow * (0.42 + 0.5 * u), 0.88 * cut * cut];
    };
    halo.lay(pts, (i) => { const [w, b, o] = shape(i); return [w * 2.6, b * 0.75, o * 0.42]; });
    wick.lay(pts, shape);
  };

  /* ---- letting go, at the shooter ---- */

  const spark = mote(CORE, 0.4);
  spark.position.copy(muzzle);
  g.add(spark);

  const lamp = new THREE.PointLight(look.spark, 0, 4.2, 2);
  lamp.position.copy(muzzle).setY(muzzle.y + 0.55);
  g.add(lamp);

  /* ---- the kill ---- */

  // Everything that belongs ON the victim's card hangs off one group, because
  // that card does not stay put: it is knocked away along the line from the
  // moment the lance lands. Drawn at the square's resting height, as the first
  // pass did, the whole impact was left behind on the stone within two frames.
  const impact = new THREE.Group();
  impact.position.copy(aim);
  g.add(impact);
  const over = (y) => y - aim.y;

  const flash = mote(CORE, 0.30);
  flash.position.y = over(head.y);
  const bloom = mote(look.glow, 0.5);
  bloom.position.y = over(head.y);
  impact.add(flash, bloom);

  const mar = crack(0.4);
  // lookAt points a MESH's +Z at its target, and the crack's arms are built in
  // its own xz plane, so aiming it leaves the star lying flat on the card with
  // its longest arms running on through the victim. Rotating it afterwards, as
  // the first pass did, stood the whole star on its edge.
  // Aimed BEFORE it is parented and BEFORE it is moved: lookAt works off the
  // object's world position, so at the origin with no parent it simply points
  // +Z down `dir`. Setting the height first would aim it at a point 26cm below
  // the card instead. `impact` only ever translates, so the quaternion set
  // here survives being parented to it.
  mar.lookAt(dir);
  mar.position.y = over(flatY(aim) + 0.004);
  mar.material.color.set(look.spark);
  impact.add(mar);

  // A hard flat ring across the card face. kit.ring draws on the STONE at
  // y=0.1, which is under the card — and it would be a second ring besides,
  // when the shock on the card is the one that says what was hit.
  const shock = blast();
  shock.lookAt(dir);
  shock.material.color.set(look.spark);
  shock.position.y = over(flatY(aim) + 0.01);
  impact.add(shock);

  // Debris goes ON along the line, away from the shooter. Thrown evenly it
  // looked like the victim had burst by itself.
  //
  // Few, big, and thrown HIGH. Nine small motes skimming forward were drawn
  // over the victim's own painting — additive colour over lit card art is just
  // slightly brighter card art — and could not be found in a screenshot. Six
  // that arc up off the card are seen against the stone, which is dark.
  const bits = [];
  for (let i = 0; i < 6; i++) {
    const s = mote(look.glow, 0.24 + Math.random() * 0.1);
    s.userData = new THREE.Vector3(
      dir.x * (0.8 + Math.random() * 1.7) + side.x * (Math.random() - 0.5) * 1.5,
      1.9 + Math.random() * 1.5,
      dir.z * (0.8 + Math.random() * 1.7) + side.z * (Math.random() - 0.5) * 1.5,
    );
    bits.push(s);
    g.add(s);
  }

  const hitLamp = new THREE.PointLight(look.spark, 0, 4.0, 2);
  hitLamp.position.copy(head).setY(head.y + 0.85);
  g.add(hitLamp);

  /* ---- one clock for all of it ---- */

  kit.hold(g, SPAN, (t) => {
    const s = t * SPAN;

    // Letting go: full size on the first frame and gone in 100ms. Grown in
    // from nothing it was at its smallest on the one frame it was bright.
    spark.material.opacity = 0.9 * Math.max(0, 1 - s / 0.1) ** 1.5;
    spark.scale.setScalar(0.3 + s * 5.5);
    lamp.intensity = 10 * Math.max(0, 1 - s / 0.11) ** 2;

    /* the lance */
    if (s < FLY) {
      const k = easeOut(s / FLY);
      lay(k, WHIP * (1 - k * k), 0, 0.065, 1, 0.06);
    } else if (s < FLY + 0.05) {
      // It goes THROUGH. The head drives a tenth of the range past the aim
      // point over the first 50ms — still inside the victim's own card — and
      // the afterimage is left standing at that length. Stopped dead on the
      // card face the lance read as having been caught rather than as having
      // killed anything.
      lay(1 + 0.11 * easeOut((s - FLY) / 0.05), 0, 0, 0.065, 1, 0.06);
    } else {
      const gh = (s - FLY) / GHOST;
      if (gh >= 1) { halo.mesh.visible = wick.mesh.visible = false; }
      else {
        // The afterimage RETRACTS rather than dims. Faded evenly it was gone
        // within 50ms of the hit at the size this is played at — there was a
        // line for four frames and then an empty board. Eaten from the muzzle
        // at full brightness instead, it stays legible the whole way out and
        // the last of it is standing over the victim, which by then is on its
        // way to the discard pile: the line is left pointing at where the card
        // used to be.
        const dim = 1 - Math.max(0, (gh - 0.45) / 0.55) ** 1.3;
        // The fray is kept LOW here on purpose. Frayed as hard as it dims, the
        // afterimage came apart into a dotted line within 100ms and the reach
        // went with it; the retract has to be the thing that removes the line
        // and the fray only the thing that stops it being a ruler.
        lay(1.11, 0, gh ** 1.15 * 1.15, 0.065 * (1 - gh * 0.45), dim, gh * 0.45);
      }
    }

    /* the kill */
    const h = (s - FLY) / HIT;
    if (h < 0) return;

    // The marks ride the card while it is still over its own square and let go
    // once it is being carried off, so what is left behind is a mark on the
    // stone where a fighter used to be. Chasing it the whole way dragged a
    // crack and a shockwave ring across two squares and off the board.
    if (mark?.group) {
      const q = mark.group.position;
      if (Math.abs(q.x - aim.x) < 0.9 && Math.abs(q.z - aim.z) < 0.9) {
        impact.position.copy(q);
      }
    }

    // Short and small. A flash a card wide wipes out the crack, the ring and
    // the card's own art, and then every ranged kill in the game looks like
    // the same white hole.
    flash.material.opacity = 0.6 * (1 - Math.min(1, h * 14)) ** 2;
    flash.scale.setScalar(0.2 + easeOut(Math.min(1, h * 10)) * 0.26);
    // Small and brief, both of them. A halo the size of the card sat on top of
    // the crack and the only thing any hit read as was a bright disc.
    bloom.material.opacity = 0.26 * (1 - Math.min(1, h * 5)) ** 1.6;
    bloom.scale.setScalar(0.45 + easeOut(Math.min(1, h * 5)) * 0.7);

    // Kept inside the card it is drawn on. At the scale this started at the
    // arms were longer than a card is wide, so the crack was a star lying
    // across three squares and the mark on the victim went with it.
    // It is over QUICKLY: the crack is a mark on a card that is being knocked
    // off its square, and 140ms after the hit that card is half a square away.
    // Left to fade slowly it went on burning in mid-air where the fighter used
    // to be, which is the opposite of what a wound is.
    const c = easeOut(Math.min(1, h * 7));
    mar.scale.setScalar(0.34 + c * 0.46);
    mar.material.opacity = (1 - Math.min(1, h * 3)) ** 1.3;

    // Snapped out and gone: scaling a ring scales its WIDTH too, so left to
    // run it ends a fat slow hoop — UI, not a shockwave.
    const r = easeOut(Math.min(1, h * 4));
    shock.scale.setScalar(0.22 + r * 0.85);
    shock.material.opacity = 0.9 * (1 - Math.min(1, h * 5.5)) ** 1.6;

    for (const b of bits) {
      const v = b.userData;
      b.position.copy(head);
      b.position.x += v.x * h; b.position.z += v.z * h;
      b.position.y += v.y * h - h * h * 2.2;
      b.material.opacity = (1 - Math.min(1, h * 1.6)) ** 1.2;
      b.scale.setScalar(0.26 * (1 - h * 0.4));
    }

    hitLamp.intensity = 12 * (1 - Math.min(1, h * 3)) ** 2;
  });

  /* ---- the shooter throws forward after it ---- */

  const me = kit.piece(at);
  if (me && !me.animating && me.restingPosition) {
    const home = me.restingPosition();
    const LEAN = 0.3;
    let held = null;
    kit.hold(new THREE.Object3D(), LEAN, (t) => {
      const x = t * LEAN;
      // A damped rock, not a recoil: it goes WITH the lash and comes back.
      const swing = Math.exp(-x * 11) * Math.cos(x * 13);
      const p = kit.piece(at);
      if (!p) return;
      p.animating = true;
      p.group.position.copy(home).addScaledVector(dir, 0.17 * swing);
      p.group.position.y = home.y + 0.06 * Math.max(0, swing);
      held = p.group.position.clone();
    }, () => {
      // Hand the card back only if nothing has taken it since: the shooter can
      // be killed by what it shot at, and that card's own exit would then be
      // running on top of this one. Restoring blind yanks a dying card back
      // onto its square.
      const p = kit.piece(at);
      if (p && held && p.group.position.distanceTo(held) < 1e-4) {
        p.group.position.copy(home);
        p.animating = false;
      }
    });
  }

  return FLY;
}

/* --------------------------------------------------------- what it kills */

/**
 * The card this shot killed, leaving.
 *
 * The generic death struck every card flat, put a red burst under it and threw
 * it at the discard pile — the same motion whatever had happened — so a
 * fighter shot from three squares away died twice: once from the lance, and
 * once again in a movement that knew nothing about where the lance had come
 * from. What happens instead is the one thing this motif owns that no other
 * does: DIRECTION. The card is punched off its square along the line of the
 * shot, turning end over end about that line's own axis, and falls away to the
 * pile still going the way it was hit.
 */
export const exit = {
  destroy(kit, piece, square, ev, done) {
    if (awaiting && awaiting.at === ev?.at) awaiting.claimed = true;
    const look = FACTION[ev?.faction] || FACTION.Neutral;
    const from = kit.at(ev?.at);
    // Nothing to animate: hand it straight back, or the card is stranded on
    // the board for the rest of the game.
    if (!piece) { done?.(); return; }
    // No shooter left to draw a line from — it can die in the same action — so
    // the ordinary death is the honest answer.
    if (!from) { kit.anim.destroy(piece, square, done); return; }

    const aim = piece.group.position.clone();
    const dir = aim.clone().sub(from).setY(0);
    if (dir.lengthSq() < 0.04) { kit.anim.destroy(piece, square, done); return; }
    dir.normalize();

    const wait = strike(kit, ev.at, look, piece, aim);

    /* ---- the card ---- */

    const rest = piece.group.position.clone();
    const pile = kit.grave(piece.owner);
    // The axis it turns about is the shot's own: across the line, so the card
    // goes over its far edge and away. Set as a quaternion because `tilt` is
    // an Euler in world axes, and a tumble about an arbitrary horizontal axis
    // is not expressible in one without fighting the rotation order.
    // The sign matters and was wrong first: turned the other way the card
    // reared UP at the shooter, as though it were rising to meet the shot
    // rather than being knocked over by it. Negative here lifts the edge the
    // lance went into and tips the card over away down the line.
    const axis = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const spun = new THREE.Quaternion();
    // Where the blow puts it: driven off the square, still low and fast.
    const struck = rest.clone().addScaledVector(dir, 1.05).setY(rest.y + 0.32);

    const PUNCH = 0.14;         // knocked off its feet
    const CARRY = 0.62;         // and carried away to the pile
    const LIFE = wait + PUNCH + CARRY;
    piece.animating = true;
    const mats = [piece.frontMat, piece.backMat, piece.card3d.material[0]];
    for (const m of mats) m.transparent = true;

    kit.anim.add(LIFE, (t) => {
      const s = t * LIFE - wait;
      // It STANDS THERE until the lance reaches it. This is the whole reason
      // the motif declares a kill time: without it the card is already in the
      // air before the shot has left the shooter.
      if (s < 0) { piece.group.position.copy(rest); return; }

      if (s < PUNCH) {
        const k = easeOut(s / PUNCH);
        piece.group.position.lerpVectors(rest, struck, k);
        spun.setFromAxisAngle(axis, -k * 0.55);
        piece.tilt.quaternion.copy(spun);
        // A hair of squash on the way out, so the blow has weight in it.
        piece.group.scale.set(1 + 0.05 * k, 1, 1 - 0.04 * k);
        return;
      }
      const e = Math.min(1, (s - PUNCH) / CARRY);
      const k = easeIn(e);
      piece.group.position.lerpVectors(struck, pile, k);
      // Thrown, not flown: it keeps rising for a moment on the strength of the
      // hit and then drops onto the pile.
      piece.group.position.y = struck.y + Math.sin(Math.PI * k) * 0.85 - k * 0.6;
      // A bit over one turn, and no more. At two the card was a blur that
      // passed through edge-on four times, and edge-on a card is a hairline —
      // what was meant to read as a body knocked away read as a flicker.
      spun.setFromAxisAngle(axis, -(0.55 + e * 5.2));   // end over end, away
      piece.tilt.quaternion.copy(spun);
      piece.group.scale.setScalar(1 - 0.3 * e);
      for (const m of mats) m.opacity = 1 - 0.85 * Math.max(0, (e - 0.45) / 0.55);
    }, () => {
      // Restore everything borrowed. Pieces are pooled, and a card that came
      // back from the pool still turned over, shrunk and half transparent is a
      // ghost on somebody's next turn.
      for (const m of mats) m.opacity = 1;
      piece.tilt.rotation.set(0, 0, 0);
      piece.group.scale.setScalar(1);
      piece.animating = false;
      done?.();
    });
  },
};
