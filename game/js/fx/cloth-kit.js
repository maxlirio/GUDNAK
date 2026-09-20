// THE CLOTH ITSELF — shared by every bolt, because a bolt IS cloth on a rod.
//
// Each bolt unrolls, runs out and winds round the target the same way; what it
// does once it HAS them is the part that differs, and that lives in its own
// file under ./effects/. Nothing here is owned by one bolt, so nothing here
// should be changed to suit one.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from './kit.js';
import { blobTexture } from '../textures.js';

const UP = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------------ cloth */

// One weave for every bolt: the material is tinted per element, so the same
// canvas serves all six.
let WEAVE = null;

/**
 * Linen — warp and weft, unevenly spun, frayed along both selvedges.
 *
 * The first version of these bolts was a flat-coloured strip, and from this
 * camera that reads as a plastic ribbon: there is nothing for the braziers to
 * catch on, so it has no surface and therefore no weight. The ribs run ACROSS
 * the bolt (canvas x is along its length) because that is the direction cloth
 * creases in, and the alpha channel carries the fray so the cloth ends in
 * threads instead of a ruled line.
 */
export function weave() {
  if (WEAVE) return WEAVE;
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  };
  let s = 20260917;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

  const [cm, g] = canvas(256, 96);
  g.fillStyle = '#b8b0a2'; g.fillRect(0, 0, 256, 96);
  // Ribs every 16px, not every 3: at this camera a fine weave is sub-pixel and
  // turns into a shimmering checkerboard. What has to read is the CREASE, so
  // the bars are coarse and high-contrast and the fine threads only dirty them.
  for (let x = 0; x < 256; x += 16) {
    const v = rnd();
    g.fillStyle = `rgba(255,252,246,${0.3 + v * 0.34})`;
    g.fillRect(x, 0, 7, 96);
    g.fillStyle = `rgba(26,20,14,${0.26 + rnd() * 0.2})`;
    g.fillRect(x + 9, 0, 5, 96);
    for (let t = 0; t < 4; t++) {                // threads within the rib
      g.fillStyle = `rgba(30,24,16,${0.06 + rnd() * 0.07})`;
      g.fillRect(x + t * 4 + rnd() * 2, 0, 1, 96);
    }
  }
  for (let y = 0; y < 96; y += 7) {              // warp: fainter, along the bolt
    g.fillStyle = `rgba(32,26,18,${0.05 + rnd() * 0.1})`;
    g.fillRect(0, y, 256, 2);
  }
  for (let i = 0; i < 16; i++) {                 // slubs — hand-loomed cloth is uneven
    g.fillStyle = `rgba(255,250,238,${0.06 + rnd() * 0.1})`;
    g.fillRect(rnd() * 256, rnd() * 96, 10 + rnd() * 40, 3 + rnd() * 5);
  }

  const [ca, ga] = canvas(64, 96);
  ga.fillStyle = '#ffffff'; ga.fillRect(0, 0, 64, 96);
  ga.fillStyle = '#000000';
  for (let x = 0; x < 64; x++) {                // frayed selvedge, both edges
    ga.fillRect(x, 0, 1, 1 + rnd() * 5);
    ga.fillRect(x, 96 - (1 + rnd() * 5), 1, 6);
  }
  for (let i = 0; i < 30; i++) ga.fillRect(rnd() * 64, rnd() * 96, 1, 1 + rnd() * 3);

  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  WEAVE = { map: tex(cm, true), alpha: tex(ca, false) };
  return WEAVE;
}

const RIBS = 4;   // columns across the cloth: enough to curl the cross-section

/** A length of cloth as a mesh: RIBS columns wide, `segments` long. */

/** A length of cloth as a mesh: RIBS columns wide, `segments` long. */
export function clothMesh(colour, segments) {
  const geo = new THREE.BufferGeometry();
  const verts = segments * RIBS;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  // The v coordinate is fixed across the cloth; u is rewritten every frame from
  // the cloth's real length, because the strip redistributes its segments as it
  // pays out and a fixed u made the weave visibly stretch while it ran.
  const uv = new Float32Array(verts * 2);
  for (let i = 0; i < segments; i++) {
    for (let c = 0; c < RIBS; c++) uv[(i * RIBS + c) * 2 + 1] = c / (RIBS - 1);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < segments - 1; i++) {
    for (let c = 0; c < RIBS - 1; c++) {
      const a = i * RIBS + c, b = a + RIBS;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  geo.setIndex(idx);

  const w = weave();
  const mat = new THREE.MeshStandardMaterial({
    color: colour, emissive: colour, emissiveIntensity: 0.22,
    map: w.map, emissiveMap: w.map, alphaMap: w.alpha,
    // alphaTest rather than plain blending: the cloth crosses itself three
    // times in the wrap, and sorted transparency made the near band vanish
    // behind the far one. It also gives the fade-out for free — as opacity
    // falls the weave is eaten away from the frayed edges inward.
    alphaTest: 0.3, transparent: true,
    roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, geo, mat };
}

/* ------------------------------------------------------------------ motif */

/**
 * The bolt itself: roll, throw, wind, grip, unwind, reel in.
 *
 * The route is precomputed once as a polyline with cumulative arc length — a
 * thrown arc, then a helix round the target — so "how much cloth is off the
 * roll" is a single number and every segment can be placed by arc length. The
 * wrapped span is pinned to that route, because cloth pulled tight has no
 * slack left; the span still in the air is run through Verlet integration so
 * it sags, whips and settles under its own weight. Physics everywhere made the
 * whole strip collapse into a heap; physics nowhere made it a ribbon of glass.
 *
 * `onGrip` is fired from inside this tick rather than by a separate timer, so
 * the payload can never drift out of step with the cloth that triggers it.
 */

/**
 * The bolt itself: roll, throw, wind, grip, unwind, reel in.
 *
 * The route is precomputed once as a polyline with cumulative arc length — a
 * thrown arc, then a helix round the target — so "how much cloth is off the
 * roll" is a single number and every segment can be placed by arc length. The
 * wrapped span is pinned to that route, because cloth pulled tight has no
 * slack left; the span still in the air is run through Verlet integration so
 * it sags, whips and settles under its own weight. Physics everywhere made the
 * whole strip collapse into a heap; physics nowhere made it a ribbon of glass.
 *
 * `onGrip` is fired from inside this tick rather than by a separate timer, so
 * the payload can never drift out of step with the cloth that triggers it.
 */
export function ribbon(kit, from, to, look, opts = {}) {
  const {
    seconds = 1.95, turns = 3.0, width = 0.33, segments = 150, onGrip = null,
  } = opts;

  // A square reference sits at y 0.4 and a card at 0.2; the cloth has to work
  // off the table either way, so both ends are pulled down to the card's face.
  const A = from.clone(); A.y = Math.min(Math.max(A.y, 0.18), 0.24);
  const C = to.clone(); C.y = Math.min(Math.max(to.y, 0.18), 0.24);
  const flat = C.clone().sub(A).setY(0);
  const dist = flat.length();
  const axis = dist > 1e-4 ? flat.clone().divideScalar(dist) : new THREE.Vector3(1, 0, 0);
  const across = new THREE.Vector3(-axis.z, 0, axis.x);

  // The roll sits on the carrier's leading edge, at about hand height.
  const ROD = A.clone().addScaledVector(axis, 0.5).setY(A.y + 0.26);

  // The wrap: a cocoon over the target, as wide as the card at its base and
  // drawn in toward the top, so it reads as a body bound up rather than a hoop.
  const R = Math.min(CARD_W, CARD_H) * 0.52;
  const RISE = 0.9;
  const band = (w) => {
    // starts on the near face, so the cloth arrives without doubling back
    const a = -Math.PI / 2 + w * Math.PI * 2 * turns;
    // A dome, not a cone: drawn from a straight taper the wrap came out as a
    // lampshade sitting on the card. The turns have to close OVER them.
    const taper = Math.sqrt(Math.max(0.04, 1 - w * w * 0.92));
    const p = C.clone()
      .addScaledVector(across, Math.cos(a) * R * taper)
      .addScaledVector(axis, Math.sin(a) * R * taper);
    p.y = C.y - 0.03 + RISE * w;
    const f = p.clone().sub(C).setY(0);
    return [p, f.lengthSq() < 1e-8 ? axis.clone() : f.normalize()];
  };

  // Route samples with running arc length. `f` is the frame vector the strip is
  // spread against: world up while the cloth is flat in the air, the outward
  // radial once it is on the body — that is what turns each turn of the helix
  // into a BAND round the target instead of a flat shelf sticking out of it.
  const FLY = 64, SAMP = 360;
  const samples = [];
  let acc = 0;
  const push = (p, f) => {
    if (samples.length) acc += p.distanceTo(samples[samples.length - 1].p);
    samples.push({ p, f, len: acc });
  };
  const [W0] = band(0);
  for (let j = 0; j <= FLY; j++) {
    const k = j / FLY;
    const p = ROD.clone().lerp(W0, k);
    // thrown, not dragged: up fast off the rod and falling onto the target, so
    // the span is a throw and not a symmetrical croquet hoop
    p.y += Math.sin(Math.PI * k ** 0.62) * (0.2 + dist * 0.085);
    push(p, UP.clone());
  }
  for (let j = 1; j <= SAMP; j++) {
    const w = j / SAMP;
    const [p, f] = band(w);
    push(p, f);
  }
  const flightLen = samples[FLY].len;
  const total = acc;
  // Turn the frame over across the last stretch of the throw, so the cloth is
  // already on edge when it meets the body and does not snap round in one frame.
  const [, f0] = band(0);
  for (let j = FLY - 20; j <= FLY; j++) {
    const k = (j - (FLY - 20)) / 20;
    samples[j].f.lerp(f0, k * 0.9).normalize();
  }

  const posAt = (u, outP, outF) => {
    const d = Math.min(Math.max(u, 0), total);
    let i = 0, j = samples.length - 1;
    while (j - i > 1) { const m = (i + j) >> 1; if (samples[m].len <= d) i = m; else j = m; }
    const a = samples[i], b = samples[j];
    const k = (d - a.len) / Math.max(1e-6, b.len - a.len);
    outP.copy(a.p).lerp(b.p, k);
    outF.copy(a.f).lerp(b.f, k);
    if (outF.lengthSq() < 1e-8) outF.copy(UP);
    outF.normalize();
    return i >= FLY;
  };

  /* ------------------------------------------------------------- the props */

  const grp = new THREE.Group();
  const { mesh, geo, mat } = clothMesh(look.colour, segments);
  grp.add(mesh);

  // The roll: cloth on a wooden rod, spun by the cloth leaving it and thinning
  // as it goes. Without this the motif is a ribbon from nowhere.
  const w = weave();
  const rollMat = new THREE.MeshStandardMaterial({
    color: look.colour, emissive: look.colour, emissiveIntensity: 0.35,
    map: w.map, emissiveMap: w.map, roughness: 0.95, metalness: 0,
  });
  const roll = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, width * 1.3, 20, 1), rollMat);
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, width * 2.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x53392a, roughness: 1 }),
  );
  roll.add(core, rod);
  // The rod lies ACROSS the throw. Setting roll.rotation.x afterwards to tip it
  // silently overwrote this quaternion — Euler and quaternion are the same
  // property — and stood the whole bolt on its end, so the lean is composed
  // onto the alignment instead.
  const qAim = new THREE.Quaternion().setFromUnitVectors(UP, across);
  const qLean = new THREE.Quaternion();
  roll.quaternion.copy(qAim);
  roll.position.copy(ROD).addScaledVector(axis, -0.1);
  grp.add(roll);

  const light = new THREE.PointLight(look.colour, 0, 6.5, 2);
  grp.add(light);

  /* ------------------------------------------------------------ the phases */

  const T_TIP = 0.045;   // the roll tips over and the first fold flops out
  const T_FLY = 0.29;    // the leading edge reaches the target
  const T_WIND = 0.55;   // the turns are laid on
  const T_GRIP = 0.61;   // pulled tight — the bolt does its work here
  const T_HOLD = 0.70;
  const T_BACK = 0.98;   // reeled back onto the rod

  const pts = [];
  for (let i = 0; i < segments; i++) pts.push({ p: ROD.clone(), o: ROD.clone() });
  const frames = [];
  for (let i = 0; i < segments; i++) frames.push(new THREE.Vector3(0, 1, 0));
  const free = new Array(segments).fill(true);

  // What the endings reach in and change: a flash on the weave, a lasting
  // recolour, and how much life is left in the flutter.
  const skin = { flash: 0, flashCol: new THREE.Color(), tint: null, tintK: 0, limp: 0 };
  const base = new THREE.Color(look.colour);
  const hue = new THREE.Color();

  const tgt = new THREE.Vector3(), tf = new THREE.Vector3();
  const tan = new THREE.Vector3(), side = new THREE.Vector3(), nrm = new THREE.Vector3();
  let prevT = 0, spin = 0, prevOut = 0, gripped = false;

  kit.hold(grp, seconds, (t) => {
    const dt = Math.min(0.05, Math.max(0.004, (t - prevT) * seconds));
    prevT = t;

    // how much cloth is off the roll, and how hard it is being pulled
    let out, tension;
    if (t < T_TIP) { out = 0; tension = 0.1; }
    else if (t < T_FLY) {
      const k = (t - T_TIP) / (T_FLY - T_TIP);
      out = flightLen * (1 - (1 - k) ** 2.2);
      tension = 0.07;   // loose: the span behind the leading edge hangs
    } else if (t < T_WIND) {
      const k = (t - T_FLY) / (T_WIND - T_FLY);
      out = flightLen + (total - flightLen) * k;
      tension = 0.38;
    } else if (t < T_HOLD) {
      out = total;
      tension = 0.7;
    } else {
      const k = (t - T_HOLD) / (T_BACK - T_HOLD);
      out = total * (1 - easeInOut(Math.min(1, k)));
      tension = 0.34;
    }

    // Cinch: the last turn hauls the whole wrap in against the body, which is
    // the beat that says the cloth has HOLD of them. It eases back off as the
    // bolt lets go.
    let cinch = 1;
    if (t > T_WIND && t < T_HOLD) {
      const k = (t - T_WIND) / (T_HOLD - T_WIND);
      cinch = 1 - 0.14 * easeOut(Math.min(1, k * 1.6));
    } else if (t >= T_HOLD) {
      cinch = 1 - 0.14 * (1 - Math.min(1, (t - T_HOLD) / 0.12));
    }

    if (!gripped && t >= T_GRIP) { gripped = true; onGrip?.(); }

    const rest = out / (segments - 1);
    for (let i = 0; i < segments; i++) {
      const q = pts[i];
      const wrapped = posAt(rest * i, tgt, tf) && out > flightLen;
      if (wrapped && cinch !== 1) {
        tgt.x = C.x + (tgt.x - C.x) * cinch;
        tgt.z = C.z + (tgt.z - C.z) * cinch;
        tgt.y = C.y + (tgt.y - C.y) * (0.5 + 0.5 * cinch);
      }
      frames[i].copy(tf);
      free[i] = !wrapped && i > 0;

      if (i === 0) { q.o.copy(q.p); q.p.copy(tgt); continue; }
      if (wrapped) { q.o.copy(q.p); q.p.lerp(tgt, 0.55); continue; }

      const vx = (q.p.x - q.o.x) * 0.965;
      const vy = (q.p.y - q.o.y) * 0.965;
      const vz = (q.p.z - q.o.z) * 0.965;
      q.o.copy(q.p);
      q.p.x += vx; q.p.y += vy - 9.2 * dt * dt; q.p.z += vz;
      q.p.lerp(tgt, tension);
      if (q.p.y < 0.13) q.p.y = 0.13;          // the cloth lies ON the flagstones
    }

    // Hold the weave together. Only the free span gives: the rod end and every
    // wrapped turn are where they are, and letting the solver drag those about
    // is what used to unravel the wrap a frame after it was laid on.
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < segments; i++) {
        const a = pts[i - 1].p, b = pts[i].p;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const len = Math.hypot(dx, dy, dz);
        if (len < 1e-5) continue;
        const pull = ((len - rest) / len) * 0.5;
        if (free[i]) { b.x -= dx * pull; b.y -= dy * pull; b.z -= dz * pull; }
        if (free[i - 1]) { a.x += dx * pull; a.y += dy * pull; a.z += dz * pull; }
      }
    }

    /* ---------------------------------------------------------- the surface */

    const flutter = 1 - skin.limp;
    const pos = geo.attributes.position.array;
    const uvs = geo.attributes.uv.array;
    const WEFT = 0.52;        // tiles of weave per world unit — one rib per 12cm
    for (let i = 0; i < segments; i++) {
      const p = pts[i].p;
      const prev = pts[Math.max(0, i - 1)].p;
      const next = pts[Math.min(segments - 1, i + 1)].p;
      tan.set(next.x - prev.x, next.y - prev.y, next.z - prev.z);
      if (tan.lengthSq() < 1e-9) tan.copy(axis);
      tan.normalize();
      side.copy(tan).cross(frames[i]);
      if (side.lengthSq() < 1e-8) side.copy(across);
      side.normalize();
      nrm.copy(side).cross(tan).normalize();

      const m = i / (segments - 1);
      // Cloth in the air turns over along its length; cloth on the body can
      // only crease.
      const twist = free[i]
        ? Math.sin(m * 7.5 - t * 9) * 0.45 * flutter
        : Math.sin(m * 21) * 0.07;
      side.applyAxisAngle(tan, twist);
      nrm.applyAxisAngle(tan, twist);

      const wave = (free[i] ? 0.09 : 0.022) * Math.sin(m * 26 - t * 16) * flutter;
      const curl = 0.26 * Math.sin(m * 11 + t * 6);
      const half = width * 0.5 * (1 - 0.45 * Math.max(0, m - 0.94) / 0.06);
      const u = rest * i * WEFT;
      for (let c = 0; c < RIBS; c++) {
        const f = c / (RIBS - 1);
        const o = (f - 0.5) * 2 * half;
        const b = Math.sin(Math.PI * f) * curl * width + wave;
        const k = (i * RIBS + c) * 3;
        pos[k + 0] = p.x + side.x * o + nrm.x * b;
        pos[k + 1] = p.y + side.y * o + nrm.y * b;
        pos[k + 2] = p.z + side.z * o + nrm.z * b;
        uvs[(i * RIBS + c) * 2] = u;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeVertexNormals();

    /* ------------------------------------------------------------ the props */

    const left = Math.max(0, total - out);
    const rad = Math.sqrt(0.0049 + (left * 0.007) / Math.PI);   // cloth has volume
    core.scale.set(rad, 1, rad);
    spin += ((out - prevOut) / Math.max(0.05, rad));
    prevOut = out;
    core.rotation.y = spin;
    rod.rotation.y = spin;
    // it rocks over as the cloth is dragged off the top of it
    qLean.setFromAxisAngle(axis, Math.sin(Math.min(1, t / T_TIP) * Math.PI * 0.5) * -0.38);
    roll.quaternion.copy(qLean).multiply(qAim);
    roll.position.y = ROD.y - (0.22 - rad) * 0.8;
    roll.visible = left > 0.02;

    // The bolt lights what it passes over, which is most of what sells it as a
    // physical object on a dark table.
    const tipIdx = Math.max(0, segments - 1);
    light.position.copy(pts[tipIdx].p).setY(pts[tipIdx].p.y + 0.35);
    light.intensity = (t < 0.9 ? 7 : 7 * (1 - (t - 0.9) / 0.1)) + skin.flash * 9;

    // colour: a lasting recolour from the ending, plus whatever flash it threw
    hue.copy(base);
    if (skin.tint) hue.lerp(skin.tint, skin.tintK);
    mat.color.copy(hue);
    mat.emissive.copy(hue);
    if (skin.flash > 0) {
      // Only part of the way to the flash colour: run all the way and the bolt
      // bleaches to white paper along its whole length, which looks like a
      // lighting bug rather than the cloth taking hold.
      mat.emissive.lerp(skin.flashCol, Math.min(0.6, skin.flash * 0.6));
      skin.flash = Math.max(0, skin.flash - dt * 4.5);
    }
    mat.emissiveIntensity = 0.22 + skin.flash * 0.5;
    mat.opacity = t < 0.95 ? 1 : 1 - (t - 0.95) / 0.05;
    rollMat.color.copy(hue);
    rollMat.emissive.copy(hue);
    rollMat.opacity = mat.opacity;
  });

  return {
    grip: T_GRIP * seconds,
    flash(colour, power = 1) { skin.flashCol.set(colour); skin.flash = power; },
    recolour(colour, k = 1) { skin.tint = new THREE.Color(colour); skin.tintK = k; },
    stiffen(k = 1) { skin.limp = k; },
  };
}

/* ----------------------------------------------------------- the payloads */

/**
 * Build now, play later.
 *
 * Animator.update filters the very list it is iterating, so a tween added from
 * inside another tween's tick — or from its onDone — is pushed onto the old
 * array and thrown away with it. That is a one-line bug in anim.js, which is
 * not this file's to fix, and it is why the first cut of these endings never
 * appeared at all: every one of them was spawned from the cloth's own tick.
 * So everything is built up front, while we are still outside that loop, and
 * parked invisible until its moment comes.
 */

/**
 * Build now, play later.
 *
 * Animator.update filters the very list it is iterating, so a tween added from
 * inside another tween's tick — or from its onDone — is pushed onto the old
 * array and thrown away with it. That is a one-line bug in anim.js, which is
 * not this file's to fix, and it is why the first cut of these endings never
 * appeared at all: every one of them was spawned from the cloth's own tick.
 * So everything is built up front, while we are still outside that loop, and
 * parked invisible until its moment comes.
 */
export function stage(kit, when, seconds, make) {
  const { obj, tick } = make();
  obj.visible = when <= 0;
  kit.hold(obj, when + seconds, (t) => {
    const s = (t * (when + seconds) - when) / seconds;
    if (s < 0) return;
    obj.visible = true;
    tick(Math.min(1, s));
  });
}

/** An expanding ring on the flagstones. */

/** An expanding ring on the flagstones. */
export function ring(kit, when, at, colour, { size = 2.2, seconds = 0.5, y = 0.05, thick = 0.14 } = {}) {
  stage(kit, when, seconds, () => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.42 + thick, 44),
      new THREE.MeshBasicMaterial({
        color: colour, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(at.y + y);
    return {
      obj: m,
      tick: (t) => {
        m.scale.setScalar(0.35 + easeOut(t) * size * 0.6);
        m.material.opacity = (1 - t) ** 1.4;
      },
    };
  });
}

/** A puff of sprites: embers, dust, frost, whatever the colour says. */

/** A puff of sprites: embers, dust, frost, whatever the colour says. */
export function puff(kit, when, at, glow, {
  count = 16, spread = 0.9, rise = 1.2, seconds = 0.7, size = 0.4, drag = 1.3, y = 0.1,
  bias = null,
} = {}) {
  stage(kit, when, seconds, () => {
    const tex = blobTexture(glow, glow.replace(/,\s*1\)$/, ',0)'));
    const grp = new THREE.Group();
    const vel = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const r = spread * (0.35 + Math.random() * 0.8);
      const v = new THREE.Vector3(Math.cos(a) * r, rise * (0.5 + Math.random()), Math.sin(a) * r);
      if (bias) v.addScaledVector(bias, 0.5 + Math.random());
      vel.push(v);
      grp.add(s);
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < grp.children.length; i++) {
          const s = grp.children[i];
          s.position.copy(at).setY(at.y + y).addScaledVector(vel[i], t);
          s.position.y -= t * t * drag;
          s.material.opacity = (1 - t) ** 1.3;
          s.scale.setScalar(size * (1 - t * 0.45));
        }
      },
    };
  });
}

/** A light that swells and dies, optionally guttering like a fire. */

/** A light that swells and dies, optionally guttering like a fire. */
export function glowAt(kit, when, at, colour, {
  power = 14, seconds = 0.5, reach = 7, flicker = 0,
} = {}) {
  stage(kit, when, seconds, () => {
    const l = new THREE.PointLight(colour, 0, reach, 2);
    l.position.copy(at);
    return {
      obj: l,
      tick: (t) => {
        const gutter = flicker ? 1 - flicker * Math.random() : 1;
        l.intensity = power * (1 - t) * (t < 0.12 ? t / 0.12 : 1) * gutter;
      },
    };
  });
}

/* --------------------------------------------------------------- the bolts */

/** Forked arcs, rebuilt each time so no two look alike. */
export function arcs(kit, when, at, { count = 7, seconds = 0.38, reach = 0.17 } = {}) {
  stage(kit, when, seconds, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff6c0, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const grp = new THREE.Group();
    for (let a = 0; a < count; a++) {
      const arc = new THREE.Group();
      // Short steps and hard kinks. Long straight strides at this scale came
      // out as white matchsticks radiating off the table.
      const dir = new THREE.Vector3(Math.random() - 0.5, 0.42, Math.random() - 0.5)
        .normalize().multiplyScalar(reach);
      let cur = new THREE.Vector3();
      for (let i = 0; i < 7; i++) {
        const nxt = cur.clone().add(dir).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.22,
        ));
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, cur.distanceTo(nxt)), mat);
        seg.position.copy(cur).lerp(nxt, 0.5);
        seg.lookAt(nxt);
        arc.add(seg);
        cur = nxt;
      }
      arc.rotation.y = Math.random() * Math.PI * 2;
      grp.add(arc);
    }
    grp.position.copy(at).setY(at.y + 0.16);
    return {
      obj: grp,
      tick: (t) => {
        // flicker rather than fade: electricity is not a dimmer switch
        mat.opacity = t < 0.7 ? (Math.random() < 0.3 ? 0.3 : 1) : 1 - (t - 0.7) / 0.3;
        for (const arc of grp.children) arc.scale.setScalar(0.5 + t * 0.85);
      },
    };
  });
}

/** Your own fighter is crackled out of one square and into another. */
