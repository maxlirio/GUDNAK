// THE BOLTS — a bolt of cloth, unrolled off the rod and wound round the target.
//
// A bolt IS cloth rolled on a rod, so that is what these are. The roll tips off
// the fighter carrying it, the leading edge is thrown across the table, and the
// cloth WINDS round the target in bands, like bandaging. Only once it has hold
// of them does the bolt do its work; then it unwinds and is reeled back in.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/bolt.js --out /tmp/b.png --settle 600
// (settle is MILLISECONDS; cloth and payload run about 2s, so take several.)

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
function weave() {
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
function clothMesh(colour, segments) {
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
function stage(kit, when, seconds, make) {
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
function ring(kit, when, at, colour, { size = 2.2, seconds = 0.5, y = 0.05, thick = 0.14 } = {}) {
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
function puff(kit, when, at, glow, {
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
function glowAt(kit, when, at, colour, {
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

export function bolt(kit, kind, from, to, extra = {}) {
  // kit.at gives a square y 0.4 and a card y 0.2. Everything below assumes the
  // card's face, and ground decals go ABOVE it — the first scorch and the first
  // shadow pool were drawn at table height and so were hidden under the very
  // card they were meant to mark.
  const face = (p) => (p ? p.clone().setY(0.21) : null);
  const a = face(kit.at(from));
  const b = face(kit.at(to)) || a;
  if (!a) return;
  // The rules write the destination as `toSquare`; `to` is the fighter the
  // bolt has hold of. Reading `to` here meant earth shoved them at their own
  // square (a zero-length direction, so a NaN slab) and lightning put them back
  // down where they started.
  const dest = extra.toSquare != null ? face(kit.at(extra.toSquare)) : null;

  const look = {
    fire:      { colour: 0xff7a2a, glow: 'rgba(255,140,60,1)' },
    ice:       { colour: 0x8fd8ff, glow: 'rgba(170,225,255,1)' },
    earth:     { colour: 0xbf9758, glow: 'rgba(210,170,110,1)' },
    lightning: { colour: 0xffe14a, glow: 'rgba(255,240,130,1)' },
    shadow:    { colour: 0x9a72d6, glow: 'rgba(160,120,225,1)' },
    doom:      { colour: 0xd8455a, glow: 'rgba(230,90,110,1)' },
  }[kind] || { colour: 0xffc46a, glow: 'rgba(255,200,120,1)' };

  const away = b.clone().sub(a).setY(0);
  if (away.lengthSq() < 1e-6) away.set(0, 0, -1);
  away.normalize();

  // The cloth only ever changes its own look from inside its tick; everything
  // else is staged from out here, where the animator will not eat it.
  const cloth = ribbon(kit, a, b, look, {
    onGrip: () => {
      if (kind === 'fire') { cloth.flash(0xffb050, 1.0); cloth.recolour(0xff9028, 0.5); }
      else if (kind === 'ice') { cloth.flash(0xbfeaff, 0.8); cloth.recolour(0xa8ddff, 0.85); cloth.stiffen(1); }
      else if (kind === 'earth') cloth.flash(0xffe0a8, 0.5);
      else if (kind === 'lightning') cloth.flash(0xffffd0, 1.0);
      else if (kind === 'shadow') { cloth.flash(0xd9b8ff, 0.6); cloth.recolour(0x3b2560, 0.75); }
      else { cloth.flash(0xffc0c8, 0.9); cloth.recolour(0xff5f72, 0.5); }
    },
  });

  const w = cloth.grip;
  if (kind === 'fire') burn(kit, w, b, look);
  else if (kind === 'ice') freeze(kit, w, b, look);
  else if (kind === 'earth') heave(kit, w, b, dest, away, look);
  else if (kind === 'lightning') blink(kit, w, b, dest, look);
  else if (kind === 'shadow') drag(kit, w, b, look);
  else doom(kit, w, b, look);
}

/* ------------------------------------------------------------------ fire */

/** They burn up inside the cloth: tongues of flame over the card's footprint. */
function burn(kit, when, at, look) {
  stage(kit, when, 1.15, () => {
    const tex = blobTexture('rgba(255,246,214,1)', 'rgba(255,110,20,0)');
    const grp = new THREE.Group();
    const seed = [];
    for (let i = 0; i < 26; i++) {
      grp.add(new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })));
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      seed.push({
        x: Math.cos(a) * r * CARD_W * 0.5, z: Math.sin(a) * r * CARD_H * 0.5,
        t0: Math.random() * 0.45, rise: 0.75 + Math.random() * 0.9,
        size: 0.42 + Math.random() * 0.5, sway: Math.random() * 6.3,
      });
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < grp.children.length; i++) {
          const s = grp.children[i], d = seed[i];
          const k = (t - d.t0) / (1 - d.t0);
          s.visible = k > 0;
          if (!s.visible) continue;
          s.position.set(
            at.x + d.x + Math.sin(k * 5 + d.sway) * 0.13,
            at.y + 0.02 + k * 1.45 * d.rise,
            at.z + d.z + Math.cos(k * 4 + d.sway) * 0.13,
          );
          s.scale.setScalar(d.size * (0.5 + k * 0.9) * (1 - k * 0.45));
          s.material.opacity = Math.min(1, k * 6) * (1 - k) ** 0.75;
          // a flame is white at its root and loses the heat as it climbs
          s.material.color.setHex(k < 0.3 ? 0xfff0c8 : (k < 0.62 ? 0xffa53c : 0xc93c10));
        }
      },
    };
  });

  puff(kit, when + 0.05, at, look.glow, { count: 20, spread: 0.7, rise: 1.5, seconds: 1.0, size: 0.26, drag: 1.1 });
  ring(kit, when, at, 0xffb45a, { size: 2.4, seconds: 0.6 });
  glowAt(kit, when, at.clone().setY(at.y + 0.7), 0xff8c30,
    { power: 24, seconds: 1.1, reach: 8, flicker: 0.35 });

  // the scorch is the only thing left once the fire has gone
  stage(kit, when + 0.1, 1.6, () => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(CARD_W * 0.58, 22),
      new THREE.MeshBasicMaterial({ color: 0x140a04, transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(at.y + 0.045);
    return {
      obj: m,
      tick: (t) => {
        m.scale.setScalar(0.5 + easeOut(Math.min(1, t * 5)) * 0.5);
        m.material.opacity = 0.46 * (1 - t * t);
      },
    };
  });
}

/* ------------------------------------------------------------------- ice */

/** The wrap freezes solid round them, then lets go in shards. */
function freeze(kit, when, at, look) {
  // The ice has to READ as ice at this camera, which means faceted and barely
  // there rather than a white dome: the first version put an opaque cap on top
  // of the wrap and it looked like a mushroom, hiding the cloth it had frozen.
  stage(kit, when, 1.3, () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdff3ff, emissive: 0x3f8cbd, emissiveIntensity: 1.1,
      transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.2,
      flatShading: true, side: THREE.DoubleSide,
    });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.98, 0), mat);
    shell.position.set(0, 0.36, 0);
    shell.scale.set(1, 0.74, 1);
    g.add(shell);

    // spikes stabbing up OUT OF THE FLAGSTONES around them, not inside the wrap
    const dirs = [];
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + Math.random() * 0.45;
      const r = 0.95 + Math.random() * 0.45;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.55 + Math.random() * 0.6, 4), mat,
      );
      spike.position.set(Math.cos(a) * r, -0.16, Math.sin(a) * r);
      spike.rotation.z = -Math.cos(a) * 0.5;
      spike.rotation.x = Math.sin(a) * 0.5;
      dirs.push(new THREE.Vector3(Math.cos(a) * 1.5, 0.8, Math.sin(a) * 1.5));
      g.add(spike);
    }
    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        const grow = easeOut(Math.min(1, t * 7));
        const crack = Math.max(0, t - 0.58) / 0.42;
        for (let i = 1; i < g.children.length; i++) {
          const spike = g.children[i];
          spike.scale.setScalar(0.15 + grow * 0.95);
          if (crack > 0) spike.position.addScaledVector(dirs[i - 1], 0.01);
        }
        const s = 0.3 + grow * 0.7 + crack * 0.45;
        shell.scale.set(s, s * 0.74, s);
        shell.rotation.y = t * 0.35;
        mat.opacity = 0.34 * (1 - crack) + 0.16 * (1 - Math.min(1, t * 7));
      },
    };
  });

  // frost creeping over the card itself
  stage(kit, when, 1.4, () => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(CARD_W * 0.62, 24),
      new THREE.MeshBasicMaterial({
        color: 0xdaf1ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(at.y + 0.04);
    return {
      obj: m,
      tick: (t) => {
        m.scale.setScalar(0.3 + easeOut(Math.min(1, t * 4)) * 0.75);
        m.material.opacity = 0.4 * (1 - Math.max(0, t - 0.6) / 0.4);
      },
    };
  });

  ring(kit, when, at, 0xa8e4ff, { size: 2.4, seconds: 0.7 });
  puff(kit, when + 0.02, at, look.glow, { count: 18, spread: 1.0, rise: 0.7, seconds: 0.9, size: 0.3, drag: 1.0 });
  puff(kit, when + 0.58, at, 'rgba(230,248,255,1)', { count: 16, spread: 1.7, rise: 0.5, seconds: 0.8, size: 0.24, drag: 1.8, y: 0.5 });
  glowAt(kit, when, at.clone().setY(at.y + 0.6), 0x8fd8ff, { power: 18, seconds: 0.7 });
}

/* ----------------------------------------------------------------- earth */

/** The wrap hauls them off their square: the ground heaves under them. */
function heave(kit, when, at, dest, away, look) {
  const dir = dest ? dest.clone().sub(at).setY(0).normalize() : away.clone();

  // The courtyard bucks up UNDER them and tips toward where they are going.
  // A slab slid across at card height read as a plank being pushed through the
  // middle of the wrap; one big box rising read as a crate. Broken ground is
  // several stones at odds with each other, and it must not clear the card.
  stage(kit, when, 0.8, () => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6d5540, roughness: 1, transparent: true, flatShading: true,
    });
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(CARD_W * 1.0, 0.4, CARD_H * 0.9), mat);
    g.add(plate);
    for (let i = 0; i < 3; i++) {
      const sh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4 + Math.random() * 0.5, 0.3, 0.35 + Math.random() * 0.4), mat,
      );
      const a = Math.random() * Math.PI * 2;
      sh.position.set(Math.cos(a) * 0.95, -0.12 + Math.random() * 0.1, Math.sin(a) * 0.95);
      sh.rotation.set(Math.random() * 0.5, a, Math.random() * 0.5 - 0.25);
      g.add(sh);
    }
    const tip = new THREE.Vector3(-dir.z, 0, dir.x);   // tilt axis, across the push
    return {
      obj: g,
      tick: (t) => {
        const lift = Math.sin(Math.PI * Math.min(1, t * 1.25)) ** 0.8;
        g.position.copy(at).setY(-0.36 + lift * 0.26).addScaledVector(dir, lift * 0.28);
        g.quaternion.setFromAxisAngle(tip, lift * 0.4);
        mat.opacity = 1 - easeIn(t);
      },
    };
  });

  stage(kit, when, 0.9, () => {
    const grp = new THREE.Group();
    const vel = [];
    const stone = new THREE.MeshStandardMaterial({
      color: 0x7d6046, roughness: 1, flatShading: true,
    });
    for (let i = 0; i < 12; i++) {
      grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + Math.random() * 0.11, 0), stone));
      vel.push(dir.clone().multiplyScalar(1.2 + Math.random() * 2.2).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.2, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2,
      )));
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < grp.children.length; i++) {
          const r = grp.children[i];
          r.position.copy(at).setY(0.16).addScaledVector(vel[i], t);
          r.position.y -= t * t * 4.4;
          if (r.position.y < 0.1) r.position.y = 0.1;
          r.rotation.set(t * 7 + i, t * 5, t * 3);
        }
      },
    };
  });

  puff(kit, when, at, 'rgba(198,166,120,1)', {
    count: 26, spread: 1.3, rise: 1.0, seconds: 0.9, size: 0.7, drag: 1.1,
    bias: dir.clone().multiplyScalar(1.7),
  });
  ring(kit, when, at, 0xc9a06a, { size: 2.4, seconds: 0.55 });
  glowAt(kit, when, at.clone().setY(0.8), 0xd2a86e, { power: 12, seconds: 0.45 });
  if (dest) {
    // the shove has to arrive somewhere, a beat later
    ring(kit, when + 0.3, dest, 0xc9a06a, { size: 2.8, seconds: 0.5 });
    puff(kit, when + 0.3, dest, look.glow, { count: 16, spread: 1.3, rise: 1.0, seconds: 0.6, size: 0.45 });
    glowAt(kit, when + 0.3, dest.clone().setY(0.7), 0xd2a86e, { power: 9, seconds: 0.4 });
  }
}

/* ------------------------------------------------------------- lightning */

/** Forked arcs, rebuilt each time so no two look alike. */
function arcs(kit, when, at, { count = 7, seconds = 0.38, reach = 0.17 } = {}) {
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
function blink(kit, when, at, dest, look) {
  const to = dest || at;
  arcs(kit, when, at, { count: 9, reach: 0.19 });
  ring(kit, when, at, look.colour, { size: 2.0, seconds: 0.4 });
  puff(kit, when, at, look.glow, { count: 12, spread: 0.7, rise: 1.8, seconds: 0.45, size: 0.3, drag: 0.6 });
  glowAt(kit, when, at.clone().setY(at.y + 0.7), look.colour, { power: 26, seconds: 0.3, reach: 6 });

  // the fighter as a bolt of light between the squares: a card-sized plate
  // stretched out of one and snapped shut on the other
  stage(kit, when + 0.04, 0.4, () => {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({
        color: 0xfff4b0, transparent: true, opacity: 0.6, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    g.rotation.x = -Math.PI / 2;
    return {
      obj: g,
      tick: (t) => {
        const k = easeInOut(Math.min(1, t / 0.85));
        g.position.copy(at).lerp(to, k);
        g.position.y = at.y + 0.12 + Math.sin(Math.PI * k) * 0.6;
        // squeezed thin in flight, because a thing that streaks is not a card
        const thin = 1 - Math.sin(Math.PI * k) * 0.82;
        g.scale.set(1 + Math.sin(Math.PI * k) * 0.55, thin, 1);
        g.material.opacity = 0.6 * (1 - Math.max(0, t - 0.7) / 0.3);
      },
    };
  });

  if (dest) {
    arcs(kit, when + 0.32, dest, { count: 10, reach: 0.21, seconds: 0.45 });
    ring(kit, when + 0.32, dest, look.colour, { size: 2.6, seconds: 0.5 });
    puff(kit, when + 0.32, dest, look.glow, { count: 14, spread: 0.8, rise: 1.6, seconds: 0.5, size: 0.32, drag: 0.6 });
    glowAt(kit, when + 0.32, dest.clone().setY(dest.y + 0.7), look.colour,
      { power: 26, seconds: 0.35, reach: 6 });
  }
}

/* ---------------------------------------------------------------- shadow */

/** Dragged down into the dark: a pool opens, tendrils take them, it shuts. */
function drag(kit, when, at, look) {
  stage(kit, when, 1.15, () => {
    const g = new THREE.Group();
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(CARD_W * 0.68, 28),
      new THREE.MeshBasicMaterial({ color: 0x0d0616, transparent: true, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.045;
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(CARD_W * 0.64, CARD_W * 0.75, 32),
      new THREE.MeshBasicMaterial({
        color: look.colour, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.055;
    g.add(pool, rim);
    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        const open = easeOut(Math.min(1, t * 4));
        const shut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
        g.scale.set(Math.max(0.01, open * shut), 1, Math.max(0.01, open * shut));
        pool.material.opacity = 0.92 * open;
        rim.material.opacity = 0.6 * open * shut;
      },
    };
  });

  stage(kit, when + 0.04, 1.0, () => {
    const mat = new THREE.MeshStandardMaterial({
      // dark things with a lit edge: at emissive 0.5 these came out as pale
      // rubber tentacles instead of shapes cut out of the light
      color: 0x1a0c2a, emissive: look.colour, emissiveIntensity: 0.22,
      roughness: 1, transparent: true,
    });
    const g = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const lean = 0.5 + Math.random() * 0.35;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55),
        new THREE.Vector3(Math.cos(a) * lean, 0.5, Math.sin(a) * lean),
        new THREE.Vector3(Math.cos(a) * 0.28, 0.9, Math.sin(a) * 0.28),
        new THREE.Vector3(Math.cos(a) * 0.04, 0.72, Math.sin(a) * 0.04),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.028 + Math.random() * 0.02, 6, false), mat));
    }
    g.position.copy(at).setY(at.y + 0.05);
    return {
      obj: g,
      tick: (t) => {
        const up = easeOut(Math.min(1, t * 2.4));
        const sink = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
        g.scale.set(1, Math.max(0.02, up * sink), 1);
        g.rotation.y = t * 0.7;
        mat.opacity = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
      },
    };
  });

  // wisps falling INTO the pool, which is the direction that tells the story
  stage(kit, when, 0.95, () => {
    const tex = blobTexture(look.glow, look.glow.replace(/,\s*1\)$/, ',0)'));
    const grp = new THREE.Group();
    const seed = [];
    for (let i = 0; i < 18; i++) {
      grp.add(new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })));
      const a = Math.random() * Math.PI * 2;
      seed.push({ a, r: 0.25 + Math.random() * 0.55, h: 0.7 + Math.random() * 0.9,
        t0: Math.random() * 0.4, spin: 2 + Math.random() * 3 });
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < grp.children.length; i++) {
          const s = grp.children[i], d = seed[i];
          const k = Math.max(0, (t - d.t0) / (1 - d.t0));
          const r = d.r * (1 - k * 0.85);
          s.position.set(
            at.x + Math.cos(d.a + k * d.spin) * r,
            at.y + 0.1 + d.h * (1 - k) ** 1.6,
            at.z + Math.sin(d.a + k * d.spin) * r,
          );
          s.scale.setScalar(0.34 * (1 - k * 0.5));
          s.material.opacity = Math.min(1, k * 5) * (1 - k);
        }
      },
    };
  });

  glowAt(kit, when, at.clone().setY(at.y + 0.5), 0x8a5ad0, { power: 14, seconds: 0.8 });
}

/* ------------------------------------------------------------------ doom */

/** It goes off where it stands: the wrap draws in, then lets go all at once. */
function doom(kit, when, at, look) {
  // implosion first — a ring running IN is what makes the burst land
  stage(kit, when, 0.28, () => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1.0, 36),
      new THREE.MeshBasicMaterial({
        color: look.colour, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(0.12);
    return {
      obj: m,
      tick: (t) => {
        m.scale.setScalar(Math.max(0.02, 2.2 * (1 - easeIn(t))));
        m.material.opacity = 0.5 + t * 0.5;
      },
    };
  });

  const go = when + 0.28;
  stage(kit, go, 0.32, () => {
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 14, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffd7dd, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    f.position.copy(at).setY(at.y + 0.3);
    return {
      obj: f,
      tick: (t) => {
        f.scale.setScalar(0.35 + easeOut(t) * 2.8);
        f.material.opacity = (1 - t) ** 2;
      },
    };
  });

  // cracks left in the flagstones under them
  stage(kit, go, 1.4, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4d0a14, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    // Each crack runs out in two strokes with a kink between them; eight even
    // spokes read as a drawn asterisk rather than split stone.
    const g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * Math.PI * 2 + Math.random() * 0.7;
      let at2 = new THREE.Vector3();
      for (let leg = 0; leg < 2; leg++) {
        const len = (leg ? 0.35 : 0.6) + Math.random() * 0.55;
        const c = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05 + Math.random() * 0.05), mat);
        c.rotation.x = -Math.PI / 2;
        c.rotation.z = -a;
        c.position.set(at2.x + Math.cos(a) * len * 0.5, 0, at2.z + Math.sin(a) * len * 0.5);
        g.add(c);
        at2 = new THREE.Vector3(at2.x + Math.cos(a) * len, 0, at2.z + Math.sin(a) * len);
        a += (Math.random() - 0.5) * 0.9;
      }
    }
    g.position.copy(at).setY(at.y + 0.045);
    return {
      obj: g,
      tick: (t) => {
        g.scale.setScalar(easeOut(Math.min(1, t * 7)));
        mat.opacity = 0.85 * (1 - t * t);
      },
    };
  });

  puff(kit, go, at, look.glow, { count: 30, spread: 2.2, rise: 1.6, seconds: 0.75, size: 0.44, drag: 1.4 });
  ring(kit, go, at, look.colour, { size: 3.6, seconds: 0.55, thick: 0.22 });
  ring(kit, go + 0.1, at, 0xffb0bc, { size: 2.4, seconds: 0.45 });
  glowAt(kit, go, at.clone().setY(at.y + 0.5), 0xff3b52, { power: 34, seconds: 0.5, reach: 9 });
}
