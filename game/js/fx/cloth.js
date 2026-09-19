// THE BOLTS — a bolt of cloth, unrolled off the rod and wound round the target.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/bolt.js --out /tmp/b.png --settle 600
// (settle is MILLISECONDS; the whole motif runs about 1.5s, so take several.)

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from './kit.js';

/**
   * A BOLT OF CLOTH — which is what a bolt IS: fabric rolled around a rod.
   *
   * It unrolls off the fighter carrying it, runs out across the table, and
   * WINDS round the target in bands, like bandaging. Only once it has hold of
   * them does the bolt do its work; then it unwinds and is drawn back in.
   *
   * The wrapped part follows a path — cloth pulled tight has no slack left —
   * while the span still in the air is run through Verlet integration so it
   * sags, whips and settles under its own weight. Physics everywhere made the
   * whole strip collapse into a heap; physics nowhere made it a ribbon of
   * glass.
   */
export function ribbon(kit, from, to, colour,
  { seconds = 1.5, turns = 3.2, width = 0.3, segments = 60 } = {}) {
    const travel = from.distanceTo(to);
    const wrapLen = turns * 2.4;
    const total = travel + wrapLen;
    const axis = to.clone().sub(from).setY(0).normalize();
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    const across = new THREE.Vector3(-axis.z, 0, axis.x);

    // Where a given length of cloth lies, measured from the rod.
    const pathAt = (u) => {
      if (u <= travel) {
        const k = travel < 1e-6 ? 0 : u / travel;
        const p = from.clone().lerp(to, k);
        p.y = from.y + 0.35 + Math.sin(Math.PI * k) * 0.55;
        return p;
      }
      // winding: successive bands stepped along the card, so it reads as
      // bandaging rather than a single hoop
      const w = (u - travel) / wrapLen;
      const a = w * Math.PI * 2 * turns;
      const band = (w - 0.5) * CARD_H * 0.62;
      const p = to.clone()
        .addScaledVector(axis, band)
        .addScaledVector(across, Math.cos(a) * CARD_W * 0.56);
      p.y = to.y + 0.14 + (Math.sin(a) * 0.5 + 0.5) * 0.42;
      return p;
    };

    const pts = [];
    for (let i = 0; i < segments; i++) pts.push({ p: from.clone(), o: from.clone() });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < segments - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);

    const mat = new THREE.MeshStandardMaterial({
      color: colour, emissive: colour, emissiveIntensity: 0.4,
      roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
      transparent: true, opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    const up = new THREE.Vector3(0, 1, 0);
    let prevT = 0;

    kit.hold(mesh, seconds, (t) => {
      const dt = Math.min(0.05, Math.max(0.004, (t - prevT) * seconds));
      prevT = t;

      // how much cloth is off the roll
      let out;
      if (t < 0.22) out = (t / 0.22) * travel;                       // running out
      else if (t < 0.5) out = travel + ((t - 0.22) / 0.28) * wrapLen; // winding on
      else if (t < 0.68) out = total;                                 // held
      else out = total * (1 - easeInOut((t - 0.68) / 0.32));          // unwinding

      const tight = t > 0.22 && t < 0.72;     // no slack while it is pulling tight

      for (let i = 0; i < segments; i++) {
        const u = (i / (segments - 1)) * out;
        const target = pathAt(u);
        const q = pts[i];

        if (i === 0 || u > travel || tight) {
          // pulled taut — it goes exactly where the winding puts it
          q.o.copy(q.p);
          q.p.lerp(target, i === 0 ? 1 : 0.45);
        } else {
          // still in the air: carry momentum, lose some to drag, and fall
          const vx = (q.p.x - q.o.x) * 0.88;
          const vy = (q.p.y - q.o.y) * 0.88;
          const vz = (q.p.z - q.o.z) * 0.88;
          q.o.copy(q.p);
          q.p.x += vx; q.p.y += vy - 7.5 * dt * dt; q.p.z += vz;
          q.p.lerp(target, 0.16);              // the rod still leads it
          if (q.p.y < 0.13) q.p.y = 0.13;
        }
      }

      // hold the weave together, so it stays one piece of cloth
      const rest = out / (segments - 1);
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 1; i < segments; i++) {
          const a = pts[i - 1].p, b = pts[i].p;
          const d = b.clone().sub(a);
          const len = d.length() || 1e-4;
          const pull = (len - rest) / len;
          b.addScaledVector(d, -pull * 0.5);
          if (i > 1) a.addScaledVector(d, pull * 0.5);
        }
      }

      // lay it out as a strip, twisting a little along its length
      const pos = geo.attributes.position.array;
      for (let i = 0; i < segments; i++) {
        const prev = pts[Math.max(0, i - 1)].p;
        const next = pts[Math.min(segments - 1, i + 1)].p;
        const tan = next.clone().sub(prev);
        if (tan.lengthSq() < 1e-8) tan.copy(axis);
        const side = tan.normalize().cross(up);
        if (side.lengthSq() < 1e-8) side.copy(across);
        side.normalize().applyAxisAngle(tan, Math.sin(i * 0.4 + t * 5) * 0.5)
          .multiplyScalar(width * 0.5);
        const p2 = pts[i].p;
        pos[i * 6 + 0] = p2.x - side.x; pos[i * 6 + 1] = p2.y - side.y; pos[i * 6 + 2] = p2.z - side.z;
        pos[i * 6 + 3] = p2.x + side.x; pos[i * 6 + 4] = p2.y + side.y; pos[i * 6 + 5] = p2.z + side.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();

      mat.opacity = t < 0.88 ? 1 : 1 - (t - 0.88) / 0.12;
    });
  }
export function bolt(kit, kind, from, to, extra = {}) {
    const a = kit.at(from);
    const b = kit.at(to) || a;
    if (!a) return;

    const look = {
      fire:      { colour: 0xff7a2a, glow: 'rgba(255,140,60,1)' },
      ice:       { colour: 0x8fd8ff, glow: 'rgba(170,225,255,1)' },
      earth:     { colour: 0xbf9758, glow: 'rgba(210,170,110,1)' },
      lightning: { colour: 0xffe14a, glow: 'rgba(255,240,130,1)' },
      shadow:    { colour: 0x9a72d6, glow: 'rgba(160,120,225,1)' },
      doom:      { colour: 0xd8455a, glow: 'rgba(230,90,110,1)' },
    }[kind] || { colour: 0xffc46a, glow: 'rgba(255,200,120,1)' };

    ribbon(kit, a, b, look.colour);

    // what happens once the cloth has hold of them
    const after = 0.78;
    kit.after(after, () => {
      if (kind === 'fire') {
        kit.sparks(b, { colour: look.glow, count: 20, spread: 0.7, seconds: 0.7, rise: 1.7 });
        kit.ring(b, look.colour, { size: 1.9, seconds: 0.55 });
      } else if (kind === 'ice') {
        frost(kit, b, look.colour);
      } else if (kind === 'earth') {
        shove(kit, b, extra.to != null ? kit.at(extra.to) : null, look);
      } else if (kind === 'lightning') {
        crackle(kit, a, look);
        if (extra.to != null) crackle(kit, kit.at(extra.to) || b, look);
      } else if (kind === 'shadow') {
        kit.sparks(b, { colour: look.glow, count: 16, spread: 0.5, seconds: 0.8, rise: -0.4 });
      } else {
        kit.sparks(b, { colour: look.glow, count: 24, spread: 1.3, seconds: 0.6, rise: 0.4 });
        kit.ring(b, look.colour, { size: 2.6, seconds: 0.5 });
      }
    });
  }

function frost(kit, at, colour) {
    const mat = new THREE.MeshStandardMaterial({
      color: colour, emissive: colour, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.85, roughness: 0.2,
    });
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5 + Math.random() * 0.4, 4), mat);
      const a = (i / 7) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.35);
      shard.rotation.z = Math.cos(a) * 0.5;
      shard.rotation.x = Math.sin(a) * 0.5;
      g.add(shard);
    }
    g.position.copy(at);
    kit.hold(g, 0.8, (t) => {
      g.scale.setScalar(0.3 + easeOut(Math.min(1, t * 2.4)) * 0.9);
      mat.opacity = 0.85 * (1 - Math.max(0, t - 0.5) / 0.5);
    });
  }

function shove(kit, at, toward, look) {
    kit.sparks(at, { colour: look.glow, count: 14, spread: 1.0, seconds: 0.5, rise: 0.3 });
    const dir = toward ? toward.clone().sub(at).normalize() : new THREE.Vector3(0, 0, -1);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: look.colour, roughness: 1, transparent: true }),
    );
    slab.position.copy(at);
    slab.lookAt(at.clone().add(dir));
    kit.hold(slab, 0.5, (t) => {
      slab.position.copy(at).addScaledVector(dir, easeOut(t) * 1.4);
      slab.position.y = 0.16 + Math.sin(Math.PI * t) * 0.2;
      slab.material.opacity = 1 - t;
    });
  }

function crackle(kit, at, look) {
    const mat = new THREE.MeshBasicMaterial({
      color: look.colour, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const g = new THREE.Group();
    const arcs = [];

    for (let a = 0; a < 5; a++) {
      const arc = new THREE.Group();
      const steps = 5;
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(0.34);
      let cur = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < steps; i++) {
        const nxt = cur.clone().add(dir).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.3,
        ));
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, cur.distanceTo(nxt)), mat);
        seg.position.copy(cur).lerp(nxt, 0.5);
        seg.lookAt(nxt);
        arc.add(seg);
        cur = nxt;
      }
      arc.rotation.y = Math.random() * Math.PI * 2;
      g.add(arc);
      arcs.push(arc);
    }
    g.position.copy(at).setY(at.y + 0.18);
    kit.hold(g, 0.34, (t) => {
      // flicker rather than fade: electricity is not a dimmer switch
      const flick = t < 0.75 ? (Math.random() < 0.35 ? 0.35 : 1) : 1 - (t - 0.75) / 0.25;
      mat.opacity = flick;
      for (const arc of arcs) arc.scale.setScalar(0.7 + t * 0.7);
    });

    const light = new THREE.PointLight(look.colour, 0, 5, 2);
    light.position.copy(at).setY(1.0);
    kit.hold(light, 0.3, (t) => { light.intensity = 11 * (1 - t); });
    kit.sparks(at, { colour: look.glow, count: 8, spread: 0.45, seconds: 0.35, rise: 1.1 });
  }
