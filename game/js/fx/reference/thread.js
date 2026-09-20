// THREAD — the Auroxi Weavers stitch. They do not throw anything.
//
// The shape of it: thread runs OUT from the fighter to pins set round the
// square, each strand led by a needle glint; then the weaver crosses from pin
// to pin so the strands lace over each other; then the whole thing is PULLED
// TAUT in one snap and holds for a beat, woven. After that something simply is
// not allowed any more, so the lattice does not explode or wipe — it sits
// there, tightens, and fades out.
//
// What it replaced was a fan of spinning boxes, which read as a windmill.
// Three things fixed that and they are all load bearing:
//   - a thread is LAID, not thrown. Each strand has a head that runs along its
//     line and a body that trails behind it, so the eye follows the stitch.
//   - the crossing strands ride over and under one another (`weave` below).
//     Without that the lattice is a flat star, and a flat star is not weaving.
//   - the tighten is a damped oscillation, not an ease. Cloth pulled tight
//     rings once and stops; easing into place looks like a menu transition.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&zoom=2.4" \
//             --eval tools/fxdemo/thread.js --out /tmp/t.png --settle 400

import { THREE, easeOut } from './kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// One texture for the life of the page — kit.hold disposes materials, never
// their maps, so this survives every cast.
let GLINT = null;
function glintTex() {
  if (GLINT) return GLINT;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,245,215,0.7)');
  grd.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.9)';      // the glint off a needle
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(32, 58); g.moveTo(6, 32); g.lineTo(58, 32);
  g.stroke();
  GLINT = new THREE.CanvasTexture(c);
  GLINT.colorSpace = THREE.SRGBColorSpace;
  return GLINT;
}

export function threads(kit, at, colour = 0xffc46a) {
  const from = kit.at(at);
  if (!from) return;

  const SPAN = 1.5;
  const SEG = 22;
  const N = 7;                                   // odd, so the chords cross
  const SKIP = [3, 2];                           // themselves instead of making
                                                 // a tidy polygon
  const TIGHTEN = 0.86;
  const FADE = 1.18;

  const hub = from.clone();
  hub.y = 0.17;                                  // off the face of the card
  const spin = rnd(0, Math.PI * 2);
  const group = new THREE.Group();
  const head = new THREE.Vector3();

  /* --- the pins. Set round the square, on the stone, at uneven distances:
     evenly spaced pins gave a wheel, and a wheel is machinery, not sewing. */
  const pins = [];
  for (let i = 0; i < N; i++) {
    const a = spin + (i / N) * Math.PI * 2 + rnd(-0.12, 0.12);
    pins.push(new THREE.Vector3(
      hub.x + Math.cos(a) * rnd(2.2, 2.8), 0.08, hub.z + Math.sin(a) * rnd(1.9, 2.4),
    ));
  }

  /* --- the strands. Radials go out first; each chord leaves a pin as soon as
     the radial that reached it has landed, which is what makes the order read
     as one continuous piece of sewing rather than a firework. */
  const strands = [];
  const strand = (a, b, born, run, o) => {
    const st = kit.strip({ segments: SEG, width: o.width, colour, emissive: 0.16 });
    st.mesh.castShadow = false;                  // a 5cm ribbon casts a dirty
    st.mat.opacity = 0;                          // aliased shadow, not a thread
    group.add(st.mesh);
    const pts = [];
    for (let i = 0; i < SEG; i++) pts.push(new THREE.Vector3());
    strands.push({ st, pts, a, b, born, run, ...o });
  };

  for (let i = 0; i < N; i++) {
    const born = 0.03 + i * 0.03;
    strand(hub, pins[i], born, rnd(0.18, 0.24), {
      width: 0.062, lift: rnd(0.22, 0.4), weave: 0, waves: 1, phase: 0, needle: true,
    });
    // Two passes round the pins, the second crossing the first — a single pass
    // is a star, and a star is not cloth. Over, under, over: the passes are in
    // antiphase, so where two threads cross one of them is riding above.
    strand(pins[i], pins[(i + SKIP[0]) % N], born + 0.26, rnd(0.2, 0.26), {
      width: 0.05, lift: rnd(0.14, 0.26), weave: 0.09, waves: 3, phase: 0, needle: false,
    });
    strand(pins[i], pins[(i + SKIP[1]) % N], born + 0.44, rnd(0.2, 0.26), {
      width: 0.05, lift: rnd(0.14, 0.26), weave: 0.09, waves: 3,
      phase: Math.PI, needle: false,
    });
  }

  /* --- the needles: the glint at the head of a running strand. */
  const needles = [];
  for (const s of strands) {
    if (!s.needle) continue;
    const m = new THREE.SpriteMaterial({
      map: glintTex(), color: colour, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    });
    const sp = new THREE.Sprite(m);
    sp.scale.setScalar(0.34);
    group.add(sp);
    needles.push({ sp, m, s });
    s.sp = sp;
  }

  /* --- a pin head where each strand lands, so the thread has something to be
     stitched THROUGH. */
  const pinMat = new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pinGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const heads = new THREE.InstancedMesh(pinGeo, pinMat, N);
  heads.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) m4.setPosition(pins[i]), heads.setMatrixAt(i, m4);
  heads.instanceMatrix.needsUpdate = true;
  group.add(heads);

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;

    // Cloth pulled tight rings once and stops. Before the pull every strand
    // carries its full sag; after it, the slack overshoots through zero and
    // dies inside a fifth of a second.
    let slack = 1, snap = 0;
    if (s > TIGHTEN) {
      const k = (s - TIGHTEN) / 0.3;
      slack = k >= 1 ? 0 : Math.exp(-k * 6.5) * Math.cos(k * 13);
      snap = Math.max(0, 1 - k) ** 2;
    }
    const out = s > FADE ? Math.max(0, 1 - (s - FADE) / (SPAN - FADE)) : 1;

    for (const st of strands) {
      const u = Math.min(1, Math.max(0, (s - st.born) / st.run));
      if (u <= 0) { st.st.mat.opacity = 0; continue; }
      const e = easeOut(u);
      head.lerpVectors(st.a, st.b, e);
      for (let i = 0; i < SEG; i++) {
        const q = i / (SEG - 1);
        const p = st.pts[i];
        p.lerpVectors(st.a, head, q);
        // a running thread bows up and is still whipping; a laid one lies in
        // its weave and only the crossings lift it
        p.y += Math.sin(Math.PI * q) * st.lift * slack * (1 - e * 0.5)
          + st.weave * Math.sin(q * Math.PI * st.waves + st.phase)
          * (0.35 + 0.65 * Math.abs(slack < 0 ? 0 : 1));
      }
      st.st.lay(st.pts, { taper: 0 });
      st.st.mat.opacity = Math.min(1, u * 5) * 0.92 * out;
      st.st.mat.emissiveIntensity = 0.55 + 1.9 * snap;
    }

    for (const n of needles) {
      const u = (s - n.s.born) / n.s.run;
      if (u <= 0 || u > 1) { n.m.opacity = 0; continue; }
      const e = easeOut(u);
      n.sp.position.lerpVectors(n.s.a, n.s.b, e);
      n.sp.position.y += Math.sin(Math.PI * e) * n.s.lift * 0.6;
      n.sp.scale.setScalar(0.34 * (1 - u * 0.35));
      n.m.opacity = Math.min(1, u * 8) * (1 - u) * 1.4;
      n.m.rotation += 0.18;
    }

    // the pins brighten as they take a thread, flare on the pull, then go
    const landed = Math.min(1, Math.max(0, (s - 0.1) / 0.4));
    pinMat.opacity = (0.35 * landed + 0.75 * snap) * out;
    heads.scale.setScalar(1 + snap * 0.7);
  });

  /* --- the light this casts is small on purpose: the Weavers are not a
     flash, and this plays on the same board as the Dragon's fire, which is
     already the loudest thing on the table. */
  const lamp = new THREE.PointLight(colour, 0, 4.2, 2);
  lamp.position.copy(hub).setY(0.7);
  kit.hold(lamp, 1.2, (t) => {
    const s = t * 1.2;
    lamp.intensity = 2.2 * Math.min(1, s / 0.2) * (1 - t) + 5 * Math.max(0, 1 - Math.abs(s - TIGHTEN) / 0.18) ** 2;
  });

  kit.after(TIGHTEN, () => {
    kit.ring(hub, colour, { size: 1.1, seconds: 0.45 });
  });
}
