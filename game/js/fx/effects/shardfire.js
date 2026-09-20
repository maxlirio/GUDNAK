// SHARD FIRE — the Shard Dragon's red-pink crystal fire, thrown for every death it causes.
//
// One effect, one file.

import { THREE } from '../kit.js';

const tongueTex = () => tex('tongue', (g) => {
  g.filter = 'blur(8px)';
  g.beginPath();
  g.moveTo(64, 12);
  g.quadraticCurveTo(101, 60, 92, 90);
  g.quadraticCurveTo(64, 118, 36, 90);
  g.quadraticCurveTo(27, 60, 64, 12);
  g.closePath();
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.3)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.78, 'rgba(255,255,255,0.95)');
  grd.addColorStop(1, 'rgba(255,255,255,0.1)');
  g.fillStyle = grd;
  g.fill();
});

/** The root of the fire — round, because the root of a fire is. */
const puffTex = () => tex('puff', (g) => {
  const lobe = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.5, `rgba(255,255,255,${a * 0.4})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  };
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    lobe(64 + Math.cos(a) * 17, 64 + Math.sin(a) * 15, 32, 0.4);
  }
  lobe(64, 64, 50, 0.6);
});

/** A hard little dot with a halo — the embers. */
const emberTex = () => tex('ember', (g) => {
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.16, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
});

/** What is left burning on the stone. Soft, with a bitten edge — not a disc. */
const coalTex = () => tex('coal', (g) => {
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grd.addColorStop(0.72, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 46 + Math.random() * 16;
    g.beginPath();
    g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 9 + Math.random() * 11, 0, Math.PI * 2);
    g.fill();
  }
});

/* -------------------------------------------------------------- colour */

// Hot pink at the root, through the shard pink of the card, down to a dark
// crimson as it cools. Additive blending does the rest: the cool end is nearly
// black and stops contributing, which is how a flame tops out.
//
// The hot end is deliberately NOT white, and its green channel is deliberately
// tiny. The renderer tone-maps with ACES, which desaturates anything bright
// towards white; three overlapping additive sprites whose green sits at 0.35
// sum past 1.0 in every channel and the plume goes white with a pink fringe,
// which is what the first three versions of this file looked like. Held near
// 0.1, green never reaches white however deep the stack gets, so the core
// clips to hot pink instead.
function heatAt(u, out) {
  let i = 1;
  while (i < RAMP.length - 1 && u > RAMP[i][0]) i++;
  const a = RAMP[i - 1], b = RAMP[i];
  const k = Math.min(1, Math.max(0, (u - a[0]) / (b[0] - a[0])));
  out.setRGB(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
}

const rnd = (a, b) => a + Math.random() * (b - a);

/* --------------------------------------------------------------- blast */

export function shardfire(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const base = p.clone();
  base.y = 0.1;                                  // the face of the card it came off
  const phase = Math.random() * Math.PI * 2;     // so two blasts never line up
  // Sized against the SQUARE, not against the card: at the table's real camera
  // distance a blast tuned to look right zoomed in was a pink smudge on one
  // card. It wants to be about as wide as the flagstone it came off.
  const gain = rnd(1.26, 1.62);                  // and no two are the same size
  const SPAN = 1.5;

  const group = new THREE.Group();
  const tint = new THREE.Color();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const vec = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /* --- the crystal. A splinter is an octahedron squeezed long: eight flat
     facets, so flatShading gives it a hard lit side and a dark side, which is
     what makes it read as crystal. The first version used cones, which have a
     smooth round flank and looked like pink party bunting.

     They are thrown mostly SIDEWAYS. Thrown mostly upward (which is what a
     burst wants to do) they overlapped into a single flower from this raised
     camera; flat and fast they skid out across the stone and the blast reads
     as big. */
  const COUNT = 11 + ((Math.random() * 4) | 0);
  const splinter = new THREE.OctahedronGeometry(0.5, 0);
  splinter.scale(0.34, 1, 0.26);

  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x9b1a3e, emissive: 0xff2f68, emissiveIntensity: 0.7,
    roughness: 0.26, metalness: 0.15, flatShading: true, transparent: true,
  });
  const shards = new THREE.InstancedMesh(splinter, crystalMat, COUNT);
  shards.frustumCulled = false;
  shards.castShadow = true;
  group.add(shards);
  // per-splinter tint, or eleven identical pink chips read as confetti
  for (let i = 0; i < COUNT; i++) {
    tint.setRGB(rnd(0.75, 1.3), rnd(0.55, 1.0), rnd(0.7, 1.15));
    shards.setColorAt(i, tint);
  }
  shards.instanceColor.needsUpdate = true;

  const bits = [];
  for (let i = 0; i < COUNT; i++) {
    const a = phase + (i / COUNT) * Math.PI * 2 + rnd(-0.22, 0.22);
    const flat = rnd(2.6, 5.4) * gain;
    const r0 = rnd(0.1, 0.3);                    // no splinter starts dead centre
    bits.push({
      ox: Math.cos(a) * r0, oz: Math.sin(a) * r0,
      vx: Math.cos(a) * flat, vz: Math.sin(a) * flat * 0.88,
      vy: rnd(1.8, 3.8) * gain,
      len: rnd(0.3, 0.6) * gain,
      // tumbling end over end about an axis across its own flight, not
      // spinning about its length — a splinter spun about its long axis has
      // the same silhouette all the way round and looks pinned in place
      tx: -Math.sin(a), tz: Math.cos(a),
      spin: rnd(-14, 14),
      life: rnd(0.5, 0.88),
    });
  }

  /* --- the fire. Tongues stand up out of a ring of roots and lean outward as
     they burn down; the tallest are at the middle, so the plume has a shape
     instead of being a hedge. A few round puffs sit at the very centre — that
     is the hard pink core the brief asks for. */
  const flames = [];
  const fire = new THREE.Group();
  group.add(fire);

  // Two waves. One burst of tongues is a pop, not a fire; the second, smaller
  // wave is the crystal catching properly a third of a second later, and it is
  // what makes the square look like it is BURNING rather than flashing.
  const wave = (n, t0, tall, hot) => {
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2 + rnd(-0.45, 0.45);
      const r = (0.14 + Math.random() ** 0.5 * 0.86) * gain;
      const m = new THREE.SpriteMaterial({
        map: tongueTex(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0,
      });
      const s2 = new THREE.Sprite(m);
      s2.center.set(0.5, 0.04);                  // burns up from its own root
      s2.scale.set(0.01, 0.01, 1);
      fire.add(s2);
      flames.push({
        s: s2, m, tongue: true,
        ox: Math.cos(a) * r, oz: Math.sin(a) * r * 0.9,
        out: rnd(0.5, 1.4) * gain,
        h: (0.3 + 0.7 * Math.exp(-r * 1.5)) * rnd(0.8, 1.35) * tall * gain,
        w: rnd(0.36, 0.54),
        lift: rnd(0.2, 0.7),
        born: t0 + (i / n) * 0.2 + rnd(0, 0.07),
        life: rnd(0.34, 0.66),
        heat: rnd(0.24, 0.4) * hot,
      });
    }
  };
  wave(22, 0.04, 1.35, 1);
  wave(14, 0.34, 0.95, 0.85);

  for (let i = 0; i < 4; i++) {                  // the core
    const m = new THREE.SpriteMaterial({
      map: puffTex(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    });
    const s = new THREE.Sprite(m);
    s.scale.set(0.01, 0.01, 1);
    fire.add(s);
    flames.push({
      s, m, tongue: false,
      ox: rnd(-0.1, 0.1), oz: rnd(-0.08, 0.08),
      out: 0.6, h: rnd(0.3, 0.46) * gain, w: 1, lift: rnd(0.2, 0.5),
      born: rnd(0, 0.04), life: rnd(0.2, 0.32), heat: 0.3,
    });
  }

  /* --- embers. One Points cloud rather than sprites: they outlive everything
     else and there can be six clouds up at once. */
  const EMBERS = 13;
  const emGeo = new THREE.BufferGeometry();
  const emPos = new Float32Array(EMBERS * 3);
  const emCol = new Float32Array(EMBERS * 4);
  emGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
  emGeo.setAttribute('color', new THREE.BufferAttribute(emCol, 4));
  const embers = new THREE.Points(emGeo, new THREE.PointsMaterial({
    map: emberTex(), size: 0.16 * gain, sizeAttenuation: true, vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  embers.frustumCulled = false;
  group.add(embers);
  const em = [];
  for (let i = 0; i < EMBERS; i++) {
    const a = phase + (i / EMBERS) * Math.PI * 2 + rnd(-0.4, 0.4);
    const r = rnd(0.7, 2.0) * gain;
    em.push({
      vx: Math.cos(a) * r, vz: Math.sin(a) * r * 0.9, vy: rnd(2.0, 3.8) * gain,
      born: rnd(0, 0.12), life: rnd(0.9, 1.35), flick: rnd(18, 34), heat: rnd(0.5, 1),
    });
  }

  /* --- what is left burning on the square. It sits just ABOVE the card face,
     not under it: the fighter that just died should be lit by its own fire. */
  const coal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9 * gain, 1.9 * gain),
    new THREE.MeshBasicMaterial({
      map: coalTex(), color: 0xff2f68, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  coal.rotation.x = -Math.PI / 2;
  coal.rotation.z = phase;
  coal.position.set(base.x, base.y + 0.02, base.z);
  group.add(coal);

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;

    for (let i = 0; i < COUNT; i++) {
      const b = bits[i];
      const u = Math.min(1, s / b.life);
      const drag = 1 - 0.38 * u;
      // ballistic, and it stops at the stone rather than sinking through it
      const y = Math.max(0.07, base.y + b.vy * s - 5.6 * s * s);
      vec.set(base.x + b.ox + b.vx * s * drag, y, base.z + b.oz + b.vz * s * drag);
      axis.set(b.vx, b.vy - 11.2 * s, b.vz);
      if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
      axis.normalize();
      q.setFromUnitVectors(UP, axis);
      roll.setFromAxisAngle(axis.set(b.tx, 0, b.tz), b.spin * s);
      q.premultiply(roll);
      // full size the moment it is thrown, burning down to nothing on landing
      const k = Math.min(1, u * 8) * (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);
      mat4.compose(vec, q, scale.setScalar(b.len * k));
      shards.setMatrixAt(i, mat4);
    }
    shards.instanceMatrix.needsUpdate = true;
    crystalMat.emissiveIntensity = 0.7 * (1 - t * 0.5);

    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const u = (s - f.born) / f.life;
      if (u <= 0 || u >= 1) { f.m.opacity = 0; continue; }
      const spread = 1 + f.out * u ** 0.7;
      f.s.position.set(base.x + f.ox * spread, base.y + 0.02 + f.lift * u ** 1.6,
        base.z + f.oz * spread);
      // up fast, then burning down: a tongue is at its tallest early
      const k = u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7 * 0.75;
      if (f.tongue) f.s.scale.set(f.h * f.w * (0.55 + 0.45 * k), f.h * k, 1);
      else f.s.scale.set(f.h * (0.4 + k), f.h * (0.4 + k), 1);
      heatAt(u, tint);
      f.m.color.copy(tint);
      f.m.opacity = f.heat * (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88);
    }

    for (let i = 0; i < EMBERS; i++) {
      const e = em[i];
      const u = (s - e.born) / e.life;
      const a4 = i * 4;
      if (u <= 0 || u >= 1) { emCol[a4 + 3] = 0; continue; }
      const es = s - e.born;
      emPos[i * 3] = base.x + e.vx * es * (1 - 0.3 * u);
      emPos[i * 3 + 1] = Math.max(0.08, base.y + e.vy * es - 3.9 * es * es);
      emPos[i * 3 + 2] = base.z + e.vz * es * (1 - 0.3 * u);
      heatAt(0.1 + u * 0.75, tint);
      const flick = 0.65 + 0.35 * Math.sin(s * e.flick + i);
      emCol[a4] = tint.r; emCol[a4 + 1] = tint.g; emCol[a4 + 2] = tint.b;
      emCol[a4 + 3] = e.heat * flick * (1 - u) * (u < 0.08 ? u / 0.08 : 1);
    }
    emGeo.attributes.position.needsUpdate = true;
    emGeo.attributes.color.needsUpdate = true;

    const burn = s < 0.09 ? s / 0.09 : Math.max(0, 1 - (s - 0.09) / (SPAN - 0.09)) ** 2.4;
    coal.material.opacity = 0.17 * burn * (0.82 + 0.18 * Math.sin(s * 26 + phase));
    coal.scale.setScalar(0.55 + 0.45 * Math.min(1, s / 0.22));
  });

  /* --- the ground. A hard fast ring for the crack, a slower wide one for the
     pressure going out of it.
     These are drawn here rather than with kit.ring because that one scales a
     fixed-width annulus: ask it for a wide ring and the band scales with the
     radius, and at the size this blast wants it stopped being a shockwave and
     became a solid pink puddle around the card. This keeps the band thin as
     the radius grows. */
  const shock = (r0, r1, seconds, colour, alpha, delay) => kit.after(delay, () => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 56),
      new THREE.MeshBasicMaterial({
        color: colour, transparent: true, opacity: alpha, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(base.x, base.y + 0.015, base.z);
    ring.scale.setScalar(r0);
    kit.hold(ring, seconds, (t) => {
      const e = 1 - (1 - t) ** 3;
      ring.scale.setScalar(r0 + (r1 - r0) * e);
      ring.material.opacity = alpha * (1 - t) ** 1.4;
    });
  });
  shock(0.25, 1.7 * gain, 0.34, 0xff79a8, 1.3, 0.001);
  shock(0.5, 2.9 * gain, 0.6, 0xff2f68, 0.75, 0.09);

  /* --- light. Reach is 4.6 and the squares are 2.9 apart, so with quadratic
     decay a neighbouring card catches an edge of this and the far side of the
     board catches nothing. This is the part that must not grow. */
  const flash = new THREE.PointLight(0xff6a9c, 0, 4.6, 2);
  flash.position.set(base.x, base.y + 0.5, base.z);
  kit.hold(flash, 0.2, (t) => { flash.intensity = 7 * (1 - t) * (t < 0.15 ? t / 0.15 : 1); });

  const glow = new THREE.PointLight(0xff3a72, 0, 4.0, 2);
  glow.position.set(base.x, base.y + 0.35, base.z);
  kit.hold(glow, 0.85, (t) => {
    glow.intensity = 4.5 * (1 - t) ** 1.5 * (0.78 + 0.22 * Math.sin(t * 40 + phase));
  });
}
