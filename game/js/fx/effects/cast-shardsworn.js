// THE SHARDSWORN FLOURISH — crystal — pink, coming apart in facets.
//
// What a Shardsworn card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// One effect, one file.
//
// THE GESTURE: crystal GROWS over the card from a seed at its middle, locks
// for a beat into one faceted crust, then lets go — the seams open and the
// pieces tip off outward and thin away. Growth first and breakage second is
// the whole read; a thing that only flies apart is debris, and the Shardsworn
// are not debris, they are crystal coming out of living things.
//
// It has to stay clear of two neighbours:
//   - the other flourishes (a shaft from above, a sinking, ripples, a weave).
//     This is the only one that builds a SOLID before it does anything.
//   - shardfire.js, the Shard Dragon's blast, which is also pink crystal but
//     is meant to be loud: fifteen splinters skidding across the stone, fire,
//     embers, two shockwaves, a light reaching 4.6 that spills onto the next
//     square. So this one throws nothing and burns nothing, it stays over the
//     card that cast it, and its light reaches 2.4 — less than the 2.9 between
//     squares, so it never touches a neighbour. Side by side (?fx=pair in the
//     preview harness) they read at once as small-and-tidy against
//     big-and-violent.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&at=230" \
//             --eval tools/fxdemo/cast-shardsworn.js --out /tmp/cs.png
// ?at is milliseconds INTO the motif; see the harness for why wall clock is
// no use here.

import { THREE, FACTION, easeOut } from '../kit.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * Where the crust lies. `kit.at` answers 0.4 for a bare square but about 0.2
 * for a card, whose face is at ~0.22 — at the raw height the crystal either
 * floated above an empty square or sank into an occupied one.
 *
 * The clearance is 0.05 and not less. A flat thing drawn about 0.03 above a
 * card face loses the depth test against it and is drawn only on the stone
 * AROUND the card, which is the worst possible failure for an effect whose
 * whole job is to mark the card. The crust's underside sits 0.012 below this
 * line and its outer rim only a little above it, so both want the headroom.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.05;

/**
 * A piece of the crust: a polygon given a solid underside, so it has a top, a
 * bottom and walls. Non-indexed, so flatShading gives every face its own
 * normal and the walls go dark as the piece tips — that difference between the
 * lit top and the dark wall is what makes it read as a solid and not as a
 * shape cut out of paper.
 *
 * Every vertex also carries its own brightness: dark underneath, mid on the
 * walls, full on the top, times a per-piece tint. All the pieces share one
 * material, and without this they came out as identical chips of the same
 * pink — the look of confetti. Baking the ramp into the geometry means the
 * depth survives even where the low brazier light does not reach.
 */
function solid(top, base, tint) {
  const n = top.length;
  const bot = top.map((v) => [v[0], base, v[2]]);
  const pos = [];
  const col = [];
  const shade = (k, count) => { for (let i = 0; i < count; i++) col.push(k, k, k); };
  for (let i = 1; i < n - 1; i++) pos.push(...top[0], ...top[i], ...top[i + 1]);
  shade(tint, (n - 2) * 3);
  for (let i = 1; i < n - 1; i++) pos.push(...bot[0], ...bot[i + 1], ...bot[i]);
  shade(tint * 0.28, (n - 2) * 3);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    pos.push(...top[i], ...bot[i], ...bot[j], ...top[i], ...bot[j], ...top[j]);
    shade(tint * rnd(0.26, 0.6), 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * The lit EDGES of that piece — its top outline, as lines.
 *
 * This is what makes the motif read as crystal at the table's camera. The
 * first version was solid emissive facets, and at forty pixels to the world
 * unit, under a tone map that desaturates anything bright, the lot of them
 * summed into one flat pink lozenge lying on the card — chewing gum, not
 * crystal. Facets are read by their edges, and a one-pixel line stays a
 * one-pixel line however far off the card is, so outlines survive a distance
 * at which shaded faces do not. The bodies are now nearly clear and the
 * outlines carry the shape, which also keeps the card's own art readable
 * straight through the effect: the point is to MARK the card, not to cover it.
 */
function outline(top, tint) {
  const pos = [];
  const col = [];
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    pos.push(...top[i], ...top[j]);
    // Each end of each edge gets its own brightness, so an edge glints along
    // its length and dies at the far end. Drawn at one even brightness the
    // outlines stopped being crystal and became a WIREFRAME — from the table
    // it read as a targeting overlay the interface had drawn on the card,
    // which is the one thing a faction flourish must never look like.
    const a = tint * rnd(0.16, 1), b = tint * rnd(0.16, 1);
    col.push(a, a, a, b, b, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

const SPAN = 0.64;        // seconds, the whole motif
const GROW = 0.20;        // seed to whole crust
const BREAK = 0.30;       // held whole until here, then the seams go

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION.Shardsworn || FACTION.Neutral;

  const g = new THREE.Group();
  g.position.copy(p).setY(flatY(p));
  g.rotation.y = Math.random() * TAU;     // so two casts never lie the same way

  // Nearly clear, with just enough body to tint what is behind it. Standard
  // rather than additive: additive over a lit card goes straight to white
  // under this renderer's ACES tone map, which is how every faction flourish
  // came out the same colour the first time round.
  const body = new THREE.MeshStandardMaterial({
    color: 0x9c1a4f, emissive: 0xc72a63, emissiveIntensity: 0.12,
    roughness: 0.1, metalness: 0.4, flatShading: true, vertexColors: true,
    transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false,
  });
  // The line colour's green channel is deliberately low. Additive blending
  // plus that same tone map drive anything bright toward white, and at the
  // break the outlines went WHITE — the faction's colour gone from the effect
  // at the one frame anybody actually looks at. Held near 0.24, green never
  // reaches white however hot the edge gets, so the flare clips to hot pink.
  const line = new THREE.LineBasicMaterial({
    color: 0xff3d84, transparent: true, opacity: 0, vertexColors: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // The crack pattern. Two irregular rings of points — an inner one about a
  // quarter of the way out, an outer one near the card's rim — with the crust
  // cut into a CORE and a collar of quads between the rings.
  //
  // It was triangles all sharing the card's centre point before, and eight
  // lines meeting at one point is a wheel: on the table it read as a loading
  // spinner. Giving the middle its own piece removes the hub, and quads rather
  // than triangles give the outlines corners instead of spokes.
  const N = 8;
  const crest = (Math.random() * N) | 0;    // one point of the crust stands up
  const ring = [];
  for (let i = 0; i < N; i++) {
    // Eight, with the jitter kept under half the spacing. At seven with a
    // wider jitter two neighbours could land a third of the way round from
    // each other, and the single wedge between them was a broad flat kite that
    // read as folded paper rather than as one facet of anything.
    const a = (i / N) * TAU + rnd(-0.24, 0.24);
    const ia = a + rnd(-0.26, 0.26);
    // Radii vary widely on purpose. Held in a narrow band the outer points
    // made a near-regular polygon with a level top, and the thing on the card
    // was a CUT GEM — a jeweller's diagram, symmetrical and man-made. Crystal
    // growing out of something is ragged: it reaches further on one side than
    // the other, and one point of it stands above the rest.
    const rim = rnd(0.40, 0.76);            // the card's half-width is 0.87
    const hub = rnd(0.13, 0.32);
    ring.push({
      inner: [Math.cos(ia) * hub,
        i === crest ? rnd(0.3, 0.44) : rnd(0.09, 0.26),
        Math.sin(ia) * hub],
      outer: [Math.cos(a) * rim, rnd(0.008, 0.075), Math.sin(a) * rim],
    });
  }

  const pieces = [];
  const add = (top) => {
    // Built about its own centroid and carried by one holder, so the break
    // turns each piece in place. Turning them about the CARD's centre instead
    // swings their outer corners through half a metre and opens like a fan.
    const mid = new THREE.Vector3();
    for (const v of top) mid.add(new THREE.Vector3(v[0], 0, v[2]));
    mid.multiplyScalar(1 / top.length);
    const local = top.map((v) => [v[0] - mid.x, v[1], v[2] - mid.z]);

    const hold = new THREE.Group();
    hold.add(new THREE.Mesh(solid(local, -0.012, rnd(0.72, 1.3)), body));
    hold.add(new THREE.LineSegments(outline(local, rnd(0.62, 1.15)), line));
    // The core sits over the card's middle and has nowhere outward to go, so
    // it only lifts. The test has to be made on `mid` BEFORE normalising: a
    // normalised vector is always unit length, so the guard never fired and
    // the middle of the crust shot off sideways with all the rest.
    const out = mid.length() < 0.2 ? new THREE.Vector3() : mid.clone().normalize();
    hold.userData = {
      home: mid,
      out,
      axis: new THREE.Vector3(-out.z, 0, out.x),   // tips about its own seam
      tilt: rnd(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1),
      // A spread of reach, and a stagger on `go`, so the crust comes apart as
      // a fracture running through it rather than all at once. Even travel had
      // the pieces settle into a tidy ring round the card's border, which read
      // as a flower rather than as something broken.
      //
      // The reach is SHORT on purpose. At twice this they sprawled off the
      // card onto the stone and over the neighbouring square, which is the
      // Shard Dragon's job and not this one's — and it stopped marking any
      // card in particular.
      reach: rnd(0.24, 0.5),
      lift: rnd(0.1, 0.28),
      yaw: rnd(-0.4, 0.4),
      go: rnd(0, 0.09),
    };
    pieces.push(hold);
    g.add(hold);
    return hold;
  };

  // One wedge of the collar is left out, so the crust has a bite missing and
  // the card shows through it. Closed all the way round it was a convex ring
  // with a core in the middle, and the thing read as a CUT GEM set on the card
  // — symmetrical and finished, the opposite of crystal growing out of
  // something.
  const gap = (Math.random() * N) | 0;
  for (let i = 0; i < N; i++) {
    if (i === gap) continue;
    const j = (i + 1) % N;
    add([ring[i].inner, ring[i].outer, ring[j].outer, ring[j].inner]);
  }
  // The core, added last so it is the piece drawn over the others.
  const core = add(ring.map((r) => r.inner));
  const spun = Math.random() * TAU;
  core.userData.axis.set(Math.cos(spun), 0, Math.sin(spun));
  core.userData.tilt *= 0.5;
  core.userData.lift = 0.2;                 // it has nowhere to go but up

  // The growth sweeps round the card rather than arriving all at once: every
  // piece gets its own start, the core first, because a crystal grows FROM
  // somewhere. Without the stagger the crust simply switched on.
  pieces.forEach((h, i) => { h.userData.born = (i / N) * 0.085 + rnd(0, 0.025); });
  core.userData.born = 0;

  // Enough light to say the crystal is its own source, brief enough not to
  // change the look of the board. Reach 2.4 against 2.9 between squares: a
  // neighbouring card catches nothing at all.
  const lamp = new THREE.PointLight(look.spark, 0, 2.4, 2);
  lamp.position.y = 0.28;
  g.add(lamp);

  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  kit.hold(g, SPAN, (t) => {
    // `t` from the animator is 0..1 over the whole hold, NOT seconds. Read as
    // seconds it put the break a third of the way earlier than intended and
    // finished the motif before its own fade had run.
    const s = t * SPAN;
    const open = Math.max(0, s - BREAK) / (SPAN - BREAK);

    for (const h of pieces) {
      const u = h.userData;
      const e = easeOut(Math.max(0, s - BREAK - u.go) / (SPAN - BREAK - u.go));
      // Growing out of the seed at the middle: place and size scale together,
      // so a piece sweeps outward instead of inflating where it stands. Then
      // it thins as it leaves, rather than staying a full-size chip that only
      // turns see-through — crystal spending itself, not glass falling.
      const k = Math.min(1, Math.max(0, (s - u.born) / (GROW - u.born)));
      const grown = (0.06 + easeOut(k) * 0.94) * (1 - e * 0.24);
      h.scale.setScalar(grown);
      h.position.copy(u.home).multiplyScalar(grown).addScaledVector(u.out, e * u.reach);
      h.position.y = e * u.lift * (1 - e * 0.5);
      q.setFromAxisAngle(u.axis, u.tilt * e);
      spin.setFromAxisAngle(UP, u.yaw * e);
      h.quaternion.copy(spin).multiply(q);
    }

    // Hot while the crystal forms, hot again at the instant it breaks, quiet
    // in between — so the break has something to be brighter than. Without the
    // dip the whole motif was one even blaze and nothing in it read as an
    // event. The edges are capped below full opacity because additive lines
    // pushed past 1 sum to white, which is the failure described above.
    const snap = Math.min(1, Math.abs(s - BREAK) / 0.1);
    const made = 1 - Math.min(1, s / GROW);
    const flare = (1 - snap) ** 2;
    line.opacity = Math.min(0.9, 0.58 + flare * 0.24 + made * 0.3) * (1 - open ** 1.05);
    // Front-loaded fades. An easeIn held everything at nearly full strength
    // for two thirds of the way out, and eight bright chips sat on the card
    // long after the moment had passed — on the fortieth cast of a game, that
    // is exactly the part that becomes a nuisance.
    body.opacity = 0.36 * (1 - open) ** 1.7;
    // Emissive is NOT multiplied by the vertex colour, so every tenth of it is
    // a flat wash over the whole solid: at 0.3 it drowned the dark walls the
    // flat shading had just given us and the pieces went back to being even
    // pink chips. Kept low, the ramp survives and the braziers and the lamp
    // below do the lighting.
    body.emissiveIntensity = 0.1 + flare * 0.55;
    // A low floor under the lamp, not only the two spikes. With it at nothing
    // between forming and breaking the crystal sat in brazier light alone and
    // went to flat outlines — a diagram drawn on the card rather than an
    // object lying on it. It is a tenth of the Shard Dragon's, and it dies
    // with the pieces.
    lamp.intensity = (0.9 + 2.0 * flare + 1.5 * made) * (1 - open);
  });
}
