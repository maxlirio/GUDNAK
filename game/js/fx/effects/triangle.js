// THE TRAIT TRIANGLE BITES — Hunter over Brute over Soldier over Hunter.
//
// Half the cards in the pool print one line of that cycle, and until now it
// had no picture: the commonest rule in the game was the only one that
// happened completely invisibly. A player could win a fight because of it and
// never see why.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=300&die=1" \
//             --eval tools/fxdemo/triangle.js --out /tmp/tri.png \
//             --wait 10000 --settle 600
// `t` is milliseconds from the moment the ATTACK starts, because this motif
// only exists on top of the lunge; see the harness for why --settle alone
// cannot say where on that timeline a frame was taken. ?die=1 is the case to
// look at — the bonus is announced when it CHANGES the attacker's power, which
// usually means it is the reason the defender is on its way to the pile.
//
// It fires on roughly one attack in six — 76 of 477 over forty games — and
// that frequency is the whole design. Everything here is chosen for being
// watchable three hundred times in an evening:
//
//   IT IS PUNCTUATION, NOT A SENTENCE.  On screen for 0.30s, one shape, no
//     sparks and no debris. The ordinary hit under it already spends eighteen
//     embers and a ring; a second helping of the same material would only make
//     every sixth attack look LOUDER rather than look DIFFERENT, which is not
//     the thing being said.
//   THE BLOW IS HARDER, NOT BIGGER.  The only other thing spent is one 85ms
//     pulse of the attacker's own light, on the frame the cards meet. It is
//     what separates a hit the trait won from an ordinary one without adding
//     anything the eye has to read.
//   THE SHAPE IS THE WORD.  An equilateral triangle, point forward, about 40
//     screen pixels across — two thirds of a card. That is the only thing a
//     player has to learn, and it is the same every time: same size, same
//     brightness, same 0.30s, whoever is swinging.
//   IT WRITES ITSELF FROM THE POINT OF CONTACT.  The strokes light from the
//     leading vertex and run BOTH WAYS round the perimeter to meet at the base
//     — the cycle closing on the card being hit. Lighting it round one way
//     gave the mark a handedness that changed with the attack's direction and
//     read as a spinner.
//   IT DIES TIP LAST.  The fade runs back the way the light came, so the last
//     thing on screen is the point, touching the defender's near edge. Fading
//     it evenly left a grey triangle sitting in the gap with nothing to say.
//   IT IS A WEDGE, NOT A BADGE.  The mark is DRIVEN forward through the seam
//     over its first 130ms. Parked, it read as an icon somebody had stamped on
//     the board; moving, it reads as the blow going in.
//   IT SITS IN THE SEAM.  The mark lives in the 0.86 of bare stone between the
//     two squares: its point stops at the defender's near edge and its base is
//     back at the attacker's. Neither card's art is under it for more than a
//     corner, because the player is reading the board while this happens. It
//     is drawn on top of the cards rather than under them — see the note on
//     the meshes for why that is the only way it can land ON the blow.
//
// Contrast is bought with SHADOW, not with more light: under ACES an additive
// shape bright enough to be seen on lit stone comes out a white slab. So every
// stroke is drawn twice — a wider black casing first, the line on top — which
// is what makes a thin mark legible over a flagstone, over grass and over a
// card without being a lamp.
//
// WHERE THE DEFENDER IS is not in the arguments. The table hands every motif
// (kit, ev.at, ev.faction) and `at` is the ATTACKER's square, so the direction
// of the blow has to come from somewhere. It is not guessed: the attacker is
// already lunging when this is called, and the motif WATCHES it for the 168ms
// before the hit lands and takes its heading from the card's own displacement.
// That is the same fact the attack animation is using, so the mark cannot
// point somewhere the blow did not go. Only the effects lab — where nothing is
// lunging — falls back to looking for the nearest enemy.

import { THREE, FACTION, easeOut } from '../kit.js';
import { squareToWorld } from '../../board.js';
import { STEP } from '../../arena.js';

/**
 * When the lunge in anim.js `attack()` lands: 0.4 of a 0.42s tween. Both that
 * tween and this motif are added during the same sync pass and neither is
 * stepped until the next frame, so they share a clock.
 */
const IMPACT = 0.168;

const R = 0.68;             // circumradius: 1.18 wide, 1.02 long — 40px by 26px
const STROKE = 0.044;       // half-width of the hot line
const CASE = 2.4;           // how much wider the black casing is
const PER = 9;              // samples per side; corners want arc length, not a quad
/**
 * The height the mark is drawn at. It does not need the clearance a
 * depth-tested decal needs — these meshes do not test depth at all — but the
 * camera is pitched, so height is PARALLAX: every world unit up slides the
 * mark about 26 pixels away from where it belongs on the board. A card's face
 * is at about 0.21, and staying with it is what keeps the mark reading as
 * something lying on the table rather than hanging over it.
 */
const LIFT = 0.272;

// How far along the line from the attacker's square the centroid sits, at the
// hit and when the wedge has finished going in. Squares are STEP apart and a
// card is 1.76 long, so the defender's near edge is at 0.87 of a step: the
// mark stops with its POINT there and its body back over the empty stone of
// the seam. Started further back than this — out on the attacker's own vacated
// square, which is free at the moment of impact and makes a longer, better
// thrust — it spent its loudest frames lying across the attacker's art.
const FROM = 0.26;
const TO = 0.485;

/** The three corners. v0 leads, so the shape is aimed by rotating about y. */
const VERTS = [0, 1, 2].map((i) => {
  const a = (i / 3) * Math.PI * 2;
  return new THREE.Vector2(Math.sin(a) * R, Math.cos(a) * R);      // v0 = the point
});

const SECTIONS = 3 * (PER + 1);

/**
 * Arc position for every cross-section: 0..1 once round the perimeter, with
 * the leading vertex at BOTH ends, so distance from the point is
 * `min(s, 1-s)` and the two halves are mirror images. That symmetry is what
 * stops the mark reading as a spinner. Shared by both meshes — only the
 * geometry depends on the stroke width, the arc parameter does not.
 */
const ARC = Array.from({ length: SECTIONS }, (_, i) => {
  const k = Math.floor(i / (PER + 1));
  return (k + (i % (PER + 1)) / PER) / 3;
});

/**
 * One outline, as three straight strokes sampled along their length.
 *
 * Every vertex carries its own colour AND alpha, because the whole character
 * of the mark is where it is lit: bone at the leading point, written outward
 * round the perimeter, eaten back the same way. Three quads could not say any
 * of that — the colour would only vary from corner to corner.
 */
function build(halfWidth) {
  const pos = new Float32Array(SECTIONS * 2 * 3);
  const col = new Float32Array(SECTIONS * 2 * 4);
  const idx = [];
  // Each side is run PAST both its corners by exactly enough to mitre a 60°
  // joint — w / tan30. This was a fixed number to begin with, sized for the
  // casing, and on the thin line it stood 0.28 proud of every corner: the mark
  // came out as a six-pointed star of crossed sticks and read as an X. The
  // overhang has to belong to the stroke it is drawn on.
  const ext = halfWidth * 1.74;
  for (let k = 0; k < 3; k++) {
    const a = VERTS[k], b = VERTS[(k + 1) % 3];
    const dir = b.clone().sub(a).normalize();
    // Outward normal: the triangle is wound so rotating the side direction by
    // -90° points away from the centre.
    const nx = dir.y, nz = -dir.x;
    const span = a.distanceTo(b) + ext * 2;
    for (let j = 0; j <= PER; j++) {
      const i = k * (PER + 1) + j;
      const t = -ext + (j / PER) * span;
      const x = a.x + dir.x * t, z = a.y + dir.y * t;
      const o = i * 6;
      pos[o] = x - nx * halfWidth; pos[o + 1] = 0; pos[o + 2] = z - nz * halfWidth;
      pos[o + 3] = x + nx * halfWidth; pos[o + 4] = 0; pos[o + 5] = z + nz * halfWidth;
      // No strip across a corner, or the ribbon doubles back over the middle.
      if (j !== PER) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  return geo;
}

export function triangle(kit, at, faction) {
  const home = typeof at === 'number' ? squareToWorld(at) : kit.at(at);
  if (!home) return;
  const look = FACTION[faction] || FACTION.Neutral;

  // The attacker, found by where it IS rather than by uid: kit.at() looks a
  // reference up in the piece table first, and uids start at 1, so a square
  // index and a card's uid are the same kind of small number. Nothing has been
  // stepped yet this frame, so every card is still standing on its square.
  let mover = null;
  let best = 1.2;
  for (const p of kit.pieces?.byUid?.values?.() || []) {
    const d = Math.hypot(p.group.position.x - home.x, p.group.position.z - home.z);
    if (p.depth === 0 && d < best) { best = d; mover = p; }
  }

  const dir = new THREE.Vector3();
  const sample = () => {
    if (!mover) return 0;
    const dx = mover.group.position.x - home.x;
    const dz = mover.group.position.z - home.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.25) dir.set(dx / len, 0, dz / len);
    return len;
  };

  // Watch the lunge. The heading is taken from the card's own displacement, so
  // the mark points exactly where the blow is going — no guess, and no second
  // source of truth to drift from anim.js.
  kit.anim.add(IMPACT, sample, () => {
    if (sample() < 0.25) fallbackHeading(kit, home, mover, dir);
    // One short hard pulse of the attacker's own light where the two cards
    // meet, on the frame they meet. It has to be this bright: measured against
    // ?nofx=1 in the harness, the same light at the kit's usual power of 14
    // moved the stone by 0.08 of a grey level — it was not there at all under
    // the board's key spotlight, and had been sitting in the file doing
    // nothing. This is the only place the faction gets to say anything.
    kit.light(home.clone().addScaledVector(dir, STEP * 0.72).setY(0.45), look.spark,
      { power: 40, seconds: 0.085, reach: 4.6 });
    strike(kit, home, dir, look);
  });
}

/**
 * Nothing lunged — the effects lab, or a replay that skipped the animation.
 * Point at the nearest enemy so the mark still means something; failing that,
 * down the board away from the attacker's own end.
 */
function fallbackHeading(kit, home, mover, dir) {
  let best = STEP * 1.6;
  let target = null;
  for (const p of kit.pieces?.byUid?.values?.() || []) {
    if (p === mover || p.depth !== 0) continue;
    if (mover && p.owner === mover.owner) continue;
    const d = Math.hypot(p.group.position.x - home.x, p.group.position.z - home.z);
    if (d > 0.4 && d < best) { best = d; target = p; }
  }
  if (target) {
    dir.set(target.group.position.x - home.x, 0, target.group.position.z - home.z).normalize();
  } else {
    dir.set(0, 0, mover && mover.owner === 1 ? 1 : -1);
  }
}

/* ------------------------------------------------------------ the mark */

const IN = 0.07;            // the strokes run out from the point and meet
const HOLD = 0.13;          // closed, at full heat
const OUT = 0.10;           // eaten back to the point
const LIFE = IN + HOLD + OUT;

function strike(kit, home, dir, look) {
  // The POINT is always the same bone white, and only the tail carries the
  // attacker's colour. Taking the whole mark from the faction was tried first
  // and it will not do: ACES pulls about a third of the green into the red, so
  // Auroxi's orange arrives at full strength while Marvorren's teal arrives
  // grey, and the mark then had a different weight and a different silhouette
  // depending on who was swinging. A player has to learn ONE shape at ONE
  // brightness to be able to read it in a fifth of a second, three hundred
  // times an evening. The faction lives in the tail, in the breath of light
  // under the blow, and nowhere the shape depends on.
  const ember = new THREE.Color(look.spark).multiplyScalar(0.42);
  const bone = new THREE.Color(0.93, 0.85, 0.74);

  const grp = new THREE.Group();
  grp.position.copy(home).addScaledVector(dir, STEP * FROM);
  grp.position.y = LIFT;
  grp.rotation.y = Math.atan2(dir.x, dir.z);

  // Shadow first, light second. A hot line on lit stone under ACES is a smear
  // unless something dark is holding its edge, and darkening costs nothing at
  // this camera — it is the only contrast that is actually free here.
  //
  // Both halves are drawn WITHOUT the depth test, which is what lets the mark
  // land on the frame the blow lands. Depth-tested, it was simply not there
  // for the first 80ms of its life: at the moment of impact the attacker's
  // card is in the air directly over the seam and then recoils back through
  // it, and the defender — which is usually dying, since that is why the bonus
  // mattered — lifts and rotates into the same stone. The mark had to be
  // delayed until everything had moved out of the way, by which point it was
  // no longer part of the blow but a separate little event afterwards. Being a
  // SYMBOL rather than an object, it can be allowed on top; the power badges
  // are already drawn this way, at renderOrder 1001, and still win over it.
  const caseGeo = build(STROKE * CASE);
  const shade = new THREE.Mesh(caseGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, depthTest: false,
    side: THREE.DoubleSide,
  }));
  shade.renderOrder = 900;

  // NOT additive. The first version added the line into the stone and ACES
  // summed it past 1.0 on contact with the lit flagstone: the faction colour
  // went white and the mark read as a scratch of daylight. Blended normally,
  // an orange line stays orange whatever it is lying on, and the casing under
  // it is doing the work additive blending was being asked for.
  const lineGeo = build(STROKE);
  const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, depthTest: false,
    side: THREE.DoubleSide,
  }));
  line.renderOrder = 901;

  for (const m of [shade, line]) { m.frustumCulled = false; grp.add(m); }

  const lit = lineGeo.attributes.color;
  const dim = caseGeo.attributes.color;

  kit.hold(grp, LIFE, (t) => {
    const ms = t * LIFE;

    // The wedge goes in: a hard ease over the first 130ms and then it stops
    // dead. Coasting to a halt made it look like it was being placed.
    const drive = easeOut(Math.min(1, ms / 0.13));
    grp.position.copy(home).addScaledVector(dir, STEP * (FROM + (TO - FROM) * drive));
    grp.position.y = LIFT;
    // Struck a little oversize and settling in three frames. Without it the
    // mark simply arrived at its final size and read as a stamp being placed;
    // with it the first frame has some force behind it.
    grp.scale.setScalar(1 + 0.16 * Math.max(0, 1 - ms / 0.05));

    // How far round the perimeter the light has got, measured from the point:
    // out to 0.5 (the middle of the base), held, then eaten back — at an even
    // rate, not on an ease. easeOut on the way back took the whole base off in
    // the first two frames and then spent the rest of the fade on a stub
    // nobody could see: the mark looked switched off rather than withdrawn.
    const reach = ms < IN ? (ms / IN) * 0.5
      : ms < IN + HOLD ? 0.5
        : 0.5 * (1 - (ms - IN - HOLD) / OUT);
    const closing = ms < IN;

    for (let i = 0; i < SECTIONS; i++) {
      const d = Math.min(ARC[i], 1 - ARC[i]);   // arc distance from the leading point
      // A soft head on the running end, so the stroke is being DRAWN rather
      // than switched on segment by segment — at 0.07s that is four frames,
      // and without the gradient it flickered.
      const a = Math.min(1, Math.max(0, (reach - d) / 0.055));
      // Cooling along its own length: bone at the point, down to a dull ember
      // in the attacker's colour at the base. A mark of one flat value had no
      // direction in it — it sat on the stone like a printed icon — and this
      // is what gives the shape a front and a back without having to move it.
      const tipHeat = Math.max(0, 1 - d / 0.34) ** 1.4;
      // The running end of each stroke carries a white edge while it is still
      // being drawn, so the mark is WRITTEN rather than switched on.
      const head = closing ? Math.max(0, 1 - Math.abs(reach - d) / 0.07) : 0;
      const heat = Math.min(1, tipHeat + head * 0.8);

      const r = ember.r + (bone.r - ember.r) * heat;
      const g = ember.g + (bone.g - ember.g) * heat;
      const b = ember.b + (bone.b - ember.b) * heat;

      for (const o of [i * 8, i * 8 + 4]) {
        lit.array[o] = r; lit.array[o + 1] = g; lit.array[o + 2] = b;
        lit.array[o + 3] = a;
        dim.array[o] = 0; dim.array[o + 1] = 0; dim.array[o + 2] = 0;
        // The casing comes up BEHIND the line rather than with it. Matched
        // alpha for alpha, the first frame of the mark was a black dot with a
        // thread of white inside it — the casing is 2.4 times the width, so at
        // the moment there is barely any stroke to case it simply wins.
        dim.array[o + 3] = a * a * 0.82;
      }
    }
    lit.needsUpdate = true;
    dim.needsUpdate = true;
  });
}
