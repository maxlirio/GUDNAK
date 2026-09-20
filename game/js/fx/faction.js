// The per-faction flourish every other card gets, plus the Refractory volley.
//
// `cast` is the effect a player sees most often — it fires whenever a card
// resolves and has no motif of its own — so these are built to be read inside
// half a second and then get out of the way. The five differ in SHAPE, not in
// tint: the first pass was the same puff in five colours, and on the table,
// under warm brazier light, all five went the same washed-out white. Each one
// now has a silhouette and a DIRECTION of its own:
//
//   Refractory  a shaft from above, narrowing onto the card
//   Gloaming    everything falls inward and down, into a dark pool
//   Shardsworn  one plate over the card, breaking into facets that drift off
//   Marvorren   flat rings travelling outward from a splash
//   Auroxi      the Weavers' thread (owned by thread.js)
//
// NOTHING HERE MAY SCHEDULE FROM INSIDE A TICK. Animator.update does
// `this.running = this.running.filter(...)`, and filter fixes its length before
// the pass, so a tween pushed by a step or an onDone is both skipped and thrown
// away when the new array is assigned. kit.hold / kit.light / kit.sparks called
// from inside another motif's tick — or from a kit.after callback — silently
// never run. So every piece of every motif below is built up front and gated on
// `t` instead. (kit.ring is safe from anywhere: it lands in anim.fx, which is
// filtered after anim.running in the same update.)
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&fx=Gloaming&at=300" \
//             --eval tools/fxdemo/faction.js --out /tmp/f.png --settle 120
// ?at is milliseconds INTO the motif — headless frames are slow enough that
// wall-clock settle lands nowhere near where you think. ?fx=all fires all five
// at once on separate squares, which is the shot that actually proves they are
// telling apart; ?fx=volley for the Barrage.

import { THREE, FACTION, easeOut, easeIn } from './kit.js';
import { blobTexture } from '../textures.js';
import { threads as weave } from './thread.js';

/**
 * Soft sprite maps, kept by colour. The flourish fires on nearly every card
 * resolution, and building a fresh 128px canvas and uploading a new texture
 * each time was pure churn for a picture that never changes. kit.hold disposes
 * materials but never their maps, so these outlive every cast.
 */
const blobs = new Map();
function blob(inner, outer) {
  const key = `${inner}|${outer}`;
  let t = blobs.get(key);
  if (!t) { t = blobTexture(inner, outer); blobs.set(key, t); }
  return t;
}

/** The same rgba with a different alpha, for the outer stop of a blob. */
const alpha = (rgba, a) => rgba.replace(/[\d.]+\)$/, `${a})`);

/**
 * Where a motif's flat parts lie. `kit.at` answers 0.4 for a bare square but
 * about 0.2 for a card, whose face is at ~0.22 — so anything drawn at the raw
 * height either floated well above an empty square or sank into an occupied
 * one. Clamp to just clear of a card face either way.
 */
const flatY = (p) => Math.min(p.y, 0.225) + 0.028;

/** A glowing sprite; the workhorse mote of every motif here. */
function mote(glow, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blob(glow, alpha(glow, 0)), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0,
  }));
  s.scale.setScalar(size);
  return s;
}

export function cast(kit, at, faction) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION[faction] || FACTION.Neutral;

  switch (faction) {
    case 'Auroxi': weave(kit, at, look.spark); break;
    case 'Refractory': judgement(kit, p, look); break;
    case 'Gloaming': sink(kit, p, look); break;
    case 'Shardsworn': facets(kit, p, look); break;
    case 'Marvorren': ripples(kit, p, look); break;
    default: quiet(kit, p, look);
  }
}

/* ------------------------------------------------------- Refractory */

/**
 * A cone of light, hung from its top edge: y runs 0 to -h so that scaling the
 * parent in y drives the FOOT of the shaft toward the board while its top stays
 * in the sky. That is the descent.
 *
 * Vertex colours carry a vertical ramp — nothing at the entry, full at the foot
 * — which is the only way to end a shaft without a hard rim when there is no
 * shader to write. Several of these are nested inside each other at low opacity
 * rather than one being drawn solid: where the near wall and the far wall of a
 * cone overlap you get more light, and stacking three gives a soft core that
 * thins toward the silhouette. The first version was ONE opaque cylinder and it
 * read as a chalk pipe standing on the board, because a pipe has a silhouette
 * and light does not.
 */
function shaftCone(topR, botR, h) {
  const geo = new THREE.CylinderGeometry(topR, botR, h, 22, 3, true);
  geo.translate(0, -h / 2, 0);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + pos.getY(i) / h;            // 1 at the top, 0 at the foot
    const b = 0.1 + (1 - k) ** 1.5 * 0.9;
    col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const JUDGE = { SPAN: 0.72, STRIKE: 0.34 };   // STRIKE as a fraction of SPAN

function judgement(kit, p, look) {
  const y = flatY(p);
  const H = 1.2;
  const g = new THREE.Group();
  g.position.copy(p).setY(y);

  const shaftMat = new THREE.MeshBasicMaterial({
    color: look.spark, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const blades = new THREE.Group();
  blades.position.y = H;
  for (const [tr, br] of [[1.1, 0.52], [0.8, 0.38], [0.52, 0.24]]) {
    blades.add(new THREE.Mesh(shaftCone(tr, br, H), shaftMat));
  }
  g.add(blades);

  // Dust caught in the beam. Without it the shaft is a decal on the sky; with
  // it the light is coming from somewhere, which is the whole motif.
  const dust = [];
  for (let i = 0; i < 7; i++) {
    const d = mote(look.glow, 0.12 + Math.random() * 0.06);
    d.userData = { a: Math.random() * Math.PI * 2, r: 0.1 + Math.random() * 0.32, off: Math.random() };
    dust.push(d);
    g.add(d);
  }

  // The pool of light the shaft stands in, lying on the card.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 28),
    new THREE.MeshBasicMaterial({
      map: blob(look.glow, alpha(look.glow, 0)), color: look.spark, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  g.add(pool);

  // A ring that CLOSES instead of opening. Everything else on this table
  // expands, so a contracting one reads as Refractory out of the corner of the
  // eye, and it gives the strike something to arrive on.
  const noose = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.0, 40),
    new THREE.MeshBasicMaterial({
      color: look.spark, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  noose.rotation.x = -Math.PI / 2;
  noose.position.y = 0.005;
  g.add(noose);

  const lamp = new THREE.PointLight(look.spark, 0, 5, 2);
  lamp.position.y = 0.6;
  g.add(lamp);

  const S = JUDGE.STRIKE;
  let rang = false;
  kit.hold(g, JUDGE.SPAN, (t) => {
    const fall = Math.min(1, t / S);
    const after = Math.max(0, t - S) / (1 - S);

    blades.scale.y = 0.06 + easeIn(fall) * 0.94;
    blades.scale.x = blades.scale.z = 1 - after * 0.72;
    // it is SPENT by the strike: a shaft that lingered read as a plume of
    // smoke coming off the card rather than a light coming down onto it
    shaftMat.opacity = (t < S ? 0.2 + fall * 0.14 : 0.34) * (1 - after) ** 2.2;

    for (const d of dust) {
      const u = d.userData;
      const k = (t * 1.4 + u.off) % 1;
      const r = u.r * (0.4 + k * 0.6);
      d.position.set(Math.cos(u.a) * r, H * (1 - k) * blades.scale.y, Math.sin(u.a) * r);
      d.material.opacity = 0.8 * Math.sin(Math.PI * k) * (1 - easeIn(t));
    }

    // the noose closes onto the card, and is spent the moment it lands
    const shut = easeIn(fall);
    noose.scale.setScalar(1.9 - shut * 0.95);
    noose.material.opacity = t < S ? 0.2 + fall * 0.65 : 0.85 * (1 - Math.min(1, after * 5));

    // the strike: the pool flares white-hot, then opens out and dies
    pool.material.opacity = t < S ? 0.1 * fall : 0.5 * (1 - after) ** 1.8;
    pool.scale.setScalar(t < S ? 0.42 : 0.42 + easeOut(after) * 0.7);
    lamp.intensity = t < S ? 0 : 8 * (1 - Math.min(1, after * 2.6));

    if (!rang && t >= S) {
      rang = true;
      kit.ring(p.clone().setY(y), look.spark, { size: 1.4, seconds: 0.4 });
    }
  });
}

/* --------------------------------------------------------- Gloaming */

/**
 * The undead do not throw sparks up. A hole opens over the card and everything
 * winds down into it — inward and downward at every moment, which is the one
 * thing no other faction here does.
 *
 * The pool is normal-blended near-black rather than additive purple: additive
 * over a lit card just went pale, exactly like the rest of the first pass. And
 * there is deliberately NO point light. Gloaming taking light away is half the
 * read, and adding a glow made it a cheaper Refractory.
 */
function sink(kit, p, look) {
  const y = flatY(p);
  const g = new THREE.Group();
  g.position.copy(p).setY(y);

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 32),
    new THREE.MeshBasicMaterial({
      map: blob('rgba(10,4,20,1)', 'rgba(10,4,20,0)'),
      transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  g.add(pool);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.9, 44),
    new THREE.MeshBasicMaterial({
      color: 0x9a5cf0, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.007;
  g.add(rim);

  // A saturated violet rather than look.glow: additive blending drives any
  // pale colour straight to white, and the first pass's motes came out as
  // plain white specks with no faction in them at all.
  const MOTE = 'rgba(134,68,216,1)';
  const motes = [];
  for (let i = 0; i < 16; i++) {
    const m = mote(MOTE, 0.26);
    m.userData = {
      a: (i / 16) * Math.PI * 2 + Math.random() * 0.4,
      r: 0.8 + Math.random() * 0.45,
      h: 0.5 + Math.random() * 0.75,
      off: Math.random() * 0.26,
      size: 0.22 + Math.random() * 0.12,
    };
    motes.push(m);
    g.add(m);
  }

  kit.hold(g, 0.95, (t) => {
    const open = easeOut(Math.min(1, t / 0.2));
    const shut = t < 0.7 ? 0 : (t - 0.7) / 0.3;
    pool.material.opacity = 0.78 * open * (1 - easeIn(shut));
    pool.scale.setScalar(0.4 + open * 0.6 - shut * 0.25);
    rim.material.opacity = 0.7 * open * (1 - shut);
    rim.scale.setScalar(1.2 - open * 0.2 - shut * 0.4);

    for (const m of motes) {
      const u = m.userData;
      const k = Math.min(1, Math.max(0, (t - u.off) / (0.84 - u.off)));
      const e = easeIn(k);                     // gathers speed as it goes down
      const a = u.a + e * 2.3;                 // and winds as it falls
      const r = u.r * (1 - e) + 0.06;
      m.position.set(Math.cos(a) * r, u.h * (1 - e) + 0.03, Math.sin(a) * r);
      m.material.opacity = Math.min(1, k * 6) * (1 - e * e);
      m.scale.setScalar(u.size * (1 - e * 0.75));
    }
  });
}

/* ------------------------------------------------------- Shardsworn */

/**
 * A facet: a triangle given a little thickness, so it is a solid with a top, a
 * bottom and three walls. Non-indexed, so flatShading gives every face its own
 * normal and the walls go dark as the facet tips — that shading difference is
 * the whole reason these read as crystal. A bare triangle has one normal, is
 * lit evenly from any angle, and looks like coloured paper.
 */
function slab(A, B, C, thick) {
  const h = thick / 2;
  const v = (p, dy) => [p.x, p.y + dy, p.z];
  const T = [v(A, h), v(B, h), v(C, h)];
  const U = [v(A, -h), v(B, -h), v(C, -h)];
  const pos = [
    ...T[0], ...T[1], ...T[2],
    ...U[0], ...U[2], ...U[1],
  ];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    pos.push(...T[i], ...U[i], ...U[j], ...T[i], ...U[j], ...T[j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * One crystal plate lies over the card, then breaks. The facets start flush
 * against each other and separate along their shared seams — that is what makes
 * it read as breaking rather than as debris being thrown, which is all the
 * loose tetrahedra of the first version ever managed.
 *
 * Each facet turns about its OWN centre, not the centre of the card, so the
 * flat faces sweep through the brazier light and flash as they go. Rotating
 * them about the card centre swung the outer corners through half a metre and
 * looked like a fan opening.
 */
function facets(kit, p, look) {
  const y = flatY(p);
  const g = new THREE.Group();
  g.position.copy(p).setY(y);

  // Dark crystal with a hot emissive, not the flat card pink: a facet lit only
  // by its own colour came out as a pink paper cut-out with no depth in it.
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7d123f, emissive: 0xff3f86, emissiveIntensity: 0.45,
    roughness: 0.12, metalness: 0.55, flatShading: true,
    side: THREE.DoubleSide, transparent: true, opacity: 0.9,
  });

  // Irregular angles and radii so the seams read as a crack pattern. A regular
  // eight-way split looked like a loading spinner.
  const N = 8;
  const edge = [];
  const rad = [];
  for (let i = 0; i < N; i++) {
    edge.push((i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.5);
    rad.push(0.54 + Math.random() * 0.3);
  }

  const shards = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const a0 = edge[i];
    const a1 = edge[j] + (j === 0 ? Math.PI * 2 : 0);
    const B = new THREE.Vector3(Math.cos(a0) * rad[i], 0, Math.sin(a0) * rad[i]);
    const C = new THREE.Vector3(Math.cos(a1) * rad[j], 0, Math.sin(a1) * rad[j]);
    const mid = B.clone().add(C).multiplyScalar(1 / 3);   // apex is the origin
    const geo = slab(new THREE.Vector3().sub(mid), B.clone().sub(mid), C.clone().sub(mid), 0.05);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(mid);
    const out = mid.clone().normalize();
    m.userData = {
      home: mid.clone(),
      out,
      axis: new THREE.Vector3(-out.z, 0, out.x),     // tips about its own seam
      tilt: (0.9 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1),
      reach: 0.34 + Math.random() * 0.3,
      spin: (Math.random() - 0.5) * 1.6,
      lift: 0.16 + Math.random() * 0.2,
    };
    shards.push(m);
    g.add(m);
  }

  // The break itself: one hard flash along the plate, gone in a fifth of a
  // second. It is what gives the facets a reason to be moving.
  const flash = mote(look.glow, 0.1);
  flash.position.y = 0.1;
  g.add(flash);
  const lamp = new THREE.PointLight(look.spark, 0, 3.8, 2);
  lamp.position.y = 0.35;
  g.add(lamp);

  const q = new THREE.Quaternion();
  const spinQ = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  kit.hold(g, 0.8, (t) => {
    // Held flush for the first tenth, THEN let go. easeOut alone had them a
    // quarter of the way apart by the second frame, and a plate that is never
    // seen whole never reads as having broken.
    const e = easeOut(Math.max(0, t - 0.1) / 0.9);
    for (const m of shards) {
      const u = m.userData;
      m.position.copy(u.home).addScaledVector(u.out, e * u.reach);
      m.position.y = u.lift * Math.sin(Math.PI * Math.min(1, t * 1.2)) - t * t * 0.2;
      q.setFromAxisAngle(u.axis, u.tilt * e);
      spinQ.setFromAxisAngle(UP, u.spin * e);
      m.quaternion.copy(spinQ).multiply(q);
    }
    mat.opacity = t < 0.3 ? 0.9 : 0.9 * (1 - easeIn((t - 0.3) / 0.7));
    mat.emissiveIntensity = 0.45 + Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.65;

    const fk = Math.min(1, t / 0.2);
    flash.scale.setScalar(0.5 + easeOut(fk) * 2.6);
    flash.material.opacity = 0.85 * (1 - fk) ** 2;
    lamp.intensity = 8 * (1 - Math.min(1, t / 0.28)) ** 1.5;
  });
}

/* -------------------------------------------------------- Marvorren */

/**
 * A drop lands and the rings run outward.
 *
 * The rings are real tori rather than flat annuli, so the braziers catch a
 * highlight along the crest and the water looks wet instead of looking like a
 * selection circle. Each sits in its own parent group which is scaled in X and
 * Z while its Y is squashed: that grows the ring and FLATTENS the crest as it
 * travels. Scaling the torus itself made each ripple fatten as it spread, which
 * is backwards — a ripple loses height as it gains circumference.
 */
function ripples(kit, p, look) {
  const y = flatY(p);
  const g = new THREE.Group();
  g.position.copy(p).setY(y);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x1d7a96, emissive: look.spark, emissiveIntensity: 0.6,
    roughness: 0.1, metalness: 0.45, transparent: true,
  });

  const waves = [];
  for (let i = 0; i < 3; i++) {
    const hold = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1, 0.042, 6, 44), mat);
    torus.rotation.x = -Math.PI / 2;
    hold.add(torus);
    hold.userData = { off: i * 0.17, reach: 0.5 + i * 0.3 };
    waves.push(hold);
    g.add(hold);
  }

  // The splash that threw them: a short column straight up and straight back.
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.66, 10), mat);
  plume.position.y = 0.33;
  g.add(plume);

  const dropGeo = new THREE.SphereGeometry(0.06, 7, 5);
  const drops = [];
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(dropGeo, mat);
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.6;
    const out = 0.9 + Math.random() * 0.7;
    d.userData = {
      v: new THREE.Vector3(Math.cos(a) * out, 2.2 + Math.random() * 1.1, Math.sin(a) * out),
      off: Math.random() * 0.05,
    };
    drops.push(d);
    g.add(d);
  }

  kit.hold(g, 0.9, (t) => {
    for (const w of waves) {
      const u = w.userData;
      const k = (t - u.off) / (1 - u.off);
      w.visible = k > 0;
      if (k <= 0) continue;
      const s = 0.22 + easeOut(k) * u.reach;
      w.scale.set(s, Math.max(0.1, 1 - k * 0.9), s);
    }

    const pk = Math.min(1, t / 0.28);
    plume.visible = pk < 1;
    const tall = Math.sin(Math.PI * pk) * 1.2 + 0.05;
    plume.scale.set(1 - pk * 0.45, tall, 1 - pk * 0.45);
    plume.position.y = 0.33 * tall;

    for (const d of drops) {
      const u = d.userData;
      const k = Math.max(0, t - u.off);
      d.visible = k < 0.4;
      d.position.set(u.v.x * k, Math.max(0.03, u.v.y * k - 9 * k * k), u.v.z * k);
    }

    mat.opacity = t < 0.45 ? 0.95 : 0.95 * (1 - (t - 0.45) / 0.55);
    mat.emissiveIntensity = 0.6 * (1 - t * 0.5);
  });
}

/* ---------------------------------------------------------- neutral */

/** A card with no faction should barely interrupt the table. */
function quiet(kit, p, look) {
  kit.sparks(p, { colour: look.glow, count: 10, spread: 0.7, seconds: 0.5, rise: 1.0, size: 0.4 });
  kit.ring(p.clone().setY(flatY(p)), look.spark, { size: 1.4, seconds: 0.45 });
}

/* ----------------------------------------------------------- volley */

/**
 * A round in flight: two quads crossed along the line of travel, bright at the
 * head and fading to nothing at the tail. +Z is forward, so `lookAt` aims it.
 *
 * The first version was a flat camera-facing sprite, which has no direction in
 * it at all — from this raised camera the shots read as beads sliding along a
 * wire. Crossed quads keep a tracer's shape whether you are looking along the
 * shot or across it.
 */
function streak(len, w, colour) {
  const cuts = [[0, 0.55, 0.9], [-len * 0.12, 1, 1], [-len * 0.35, 0.72, 0.42],
    [-len * 0.62, 0.42, 0.17], [-len, 0.08, 0]];
  const pos = [];
  const col = [];
  const idx = [];
  for (let up = 0; up < 2; up++) {
    const base = pos.length / 3;
    for (const [z, wk, b] of cuts) {
      const h = w * wk * 0.5;
      if (up) pos.push(0, -h, z, 0, h, z); else pos.push(-h, 0, z, h, 0, z);
      col.push(b, b, b, b, b, b);
    }
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: colour, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
}

/**
 * BARRAGE — every enemy round the fighter gets one, all in the same breath.
 *
 * The weight is in the timing, not the size. A short gather at the shooter,
 * then the rounds leave 55ms apart so the impacts arrive as a roll rather than
 * a single thump, and the flight is fast and nearly flat — just enough loft to
 * clear the card between. The first version lobbed them on a tall arc over two
 * thirds of a second each, which made a siege engine out of a volley of shot.
 *
 * Each shot's whole life — gather, flight, impact spray, muzzle and impact
 * light — is one hold, because a hold started from inside another hold's tick
 * is dropped on the floor by the animator (see the note at the top of the
 * file). That is also why the old code's impact sparks never appeared even
 * before it threw: it called blobTexture without importing it, so the entire
 * tactic fell through fx.js's catch and drew nothing at all.
 */
export function volley(kit, from, targets = []) {
  const a = kit.at(from);
  if (!a) return;
  const look = FACTION.Refractory;
  const GLOW = 'rgba(255,238,196,1)';

  const marks = targets.map((t) => kit.at(t)).filter(Boolean);
  if (!marks.length) return;

  const muzzle = a.clone().setY(flatY(a) + 0.4);
  const WIND = 0.12, GAP = 0.038, FLY = 0.3, BOOM = 0.34;
  const SPAN = WIND + GAP * (marks.length - 1) + FLY + BOOM;

  // The gather: the fighter draws in before it looses. Without it the rounds
  // appeared out of nothing and the volley had no beginning.
  const charge = mote(GLOW, 0.3);
  charge.position.copy(muzzle);
  kit.hold(charge, WIND + 0.07, (t) => {
    const k = Math.min(1, t * (WIND + 0.07) / WIND);
    charge.scale.setScalar(0.22 + easeIn(k) * 1.0);
    charge.material.opacity = k < 1 ? 0.4 * k : 0.6 * (1 - (t - WIND / (WIND + 0.07)) * 14);
  });
  kit.ring(a.clone().setY(flatY(a)), look.spark, { size: 0.9, seconds: 0.45 });

  marks.forEach((b, i) => {
    const mark = b.clone().setY(flatY(b) + 0.14);
    const dir = mark.clone().sub(muzzle).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    // A fan has to be visible as a fan, so each round bows out to its own side
    // on the way: the spread then happens in the air and not only at the ends.
    const bow = (i - (marks.length - 1) / 2) * 0.24;
    const go = WIND + i * GAP;

    const g = new THREE.Group();            // identity transform: children are
    const shot = streak(1.35, 0.17, look.spark);  // placed in world coordinates
    shot.visible = false;
    const head = mote(GLOW, 0.42);
    head.material.opacity = 0.95;
    shot.add(head);
    g.add(shot);

    const muzzleFlash = mote(GLOW, 0.5);
    muzzleFlash.position.copy(muzzle);
    g.add(muzzleFlash);

    // Impact debris, thrown BACK the way the round came: the direction of the
    // spray is what gives the hit a sense of what hit it.
    const back = dir.clone().negate();
    const bits = [];
    for (let k = 0; k < 9; k++) {
      const s = mote(GLOW, 0.22);
      s.userData = new THREE.Vector3(
        back.x * (0.7 + Math.random() * 1.3) + side.x * (Math.random() - 0.5) * 1.4,
        1.0 + Math.random() * 1.3,
        back.z * (0.7 + Math.random() * 1.3) + side.z * (Math.random() - 0.5) * 1.4,
      );
      bits.push(s);
      g.add(s);
    }
    const burst = mote(GLOW, 0.3);
    burst.position.copy(mark);
    g.add(burst);

    const lamp = new THREE.PointLight(look.spark, 0, 3.2, 2);
    lamp.position.copy(mark).setY(mark.y + 0.3);
    g.add(lamp);

    const hereAt = (k) => {
      const q = muzzle.clone().lerp(mark, k);
      q.addScaledVector(side, Math.sin(Math.PI * k) * bow);
      q.y += Math.sin(Math.PI * k) * 0.34;
      return q;
    };

    let rang = false;
    kit.hold(g, SPAN, (t) => {
      const s = t * SPAN;
      const k = (s - go) / FLY;

      muzzleFlash.material.opacity = s < go || s > go + 0.09 ? 0
        : 0.5 * (1 - (s - go) / 0.09);
      muzzleFlash.scale.setScalar(0.35 + (s - go) * 6);

      if (k > 0 && k < 1) {
        shot.visible = true;
        shot.position.copy(hereAt(k));
        shot.lookAt(hereAt(Math.min(1, k + 0.07)));
        shot.material.opacity = 0.8 * Math.min(1, k * 7);
      } else {
        shot.visible = false;
      }

      const hit = (s - go - FLY) / BOOM;
      if (hit < 0) return;
      if (!rang) {
        rang = true;
        kit.ring(b.clone().setY(flatY(b)), look.spark, { size: 1.1, seconds: 0.35 });
      }
      for (const bit of bits) {
        const v = bit.userData;
        bit.position.copy(mark);
        bit.position.x += v.x * hit;
        bit.position.z += v.z * hit;
        bit.position.y += v.y * hit - hit * hit * 2.2;
        bit.material.opacity = (1 - hit) ** 1.1;
        bit.scale.setScalar(0.2 * (1 - hit * 0.5));
      }
      burst.scale.setScalar(0.35 + easeOut(Math.min(1, hit * 4)) * 1.0);
      burst.material.opacity = 0.85 * (1 - Math.min(1, hit * 3.6)) ** 1.5;
      lamp.intensity = 9 * (1 - Math.min(1, hit * 3)) ** 1.5;
    });
  });
}
