// THE EARTH BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.
//
// The brief is one word: HEAVE. The cloth has them, and the ground throws them
// a square sideways. So everything drawn here is weight — paving that breaks
// under the load, stone thrown along the line of the shove, and dust that is
// still settling long after the bolt has gone home. The game itself slides the
// card; what this file draws is the force that did it.

import { THREE, CARD_W, easeOut, easeIn } from '../kit.js';
import { stoneTexture } from '../../textures.js';
import { stage, ring, glowAt } from '../cloth-kit.js';

// The board's own flagstone, borrowed so the paving this bolt breaks is made
// of the same stuff as the paving it broke it out of. Untinted it comes out
// darker than the board, which is what the underside of a lifted slab should
// be. Cached because stoneTexture() redraws a 512px canvas on every call.
let SLAB = null;
const slabTexture = () => (SLAB || (SLAB = stoneTexture()));

/* --------------------------------------------------------------- the dust */

/**
 * Dust, as a cloud rather than a ball.
 *
 * The first pass used the shared sprite blob: a clean radial gradient, ADDED
 * to the frame. Two dozen of those overlap into one flat white disc with a
 * circular edge, which is what this bolt used to look like — a sticker laid
 * over the square. Dust has lobes and holes, and it hides what is behind it
 * instead of brightening it, so this is its own ragged texture drawn with
 * normal blending and tinted per grain.
 */
let DUST = null;
function dustTexture() {
  if (DUST) return DUST;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let s = 20260919;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

  // Soft all the way out, and the core is worth about a third of a sprite's
  // own opacity once the two are multiplied. There is a narrow band to hit:
  // drawn opaque — where this started — each grain is a hard white ball and a
  // puff is a handful of popcorn on the square; dropped to a tenth, the whole
  // cloud stops existing against lit flagstone. It wants to be faint enough
  // that a single grain is a wisp and dense enough that thirty are weather.
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  grd.addColorStop(0.00, 'rgba(255,255,255,0.56)');
  grd.addColorStop(0.30, 'rgba(255,255,255,0.40)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const lobe = (x, y, r, a) => {
    const l = g.createRadialGradient(x, y, 0, x, y, r);
    l.addColorStop(0, `rgba(255,255,255,${a})`);
    l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = 8 + rnd() * 30;
    lobe(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 12 + rnd() * 22, 0.04 + rnd() * 0.07);
  }
  // Bite holes back out of it, or the lobes fill each other in and the
  // silhouette closes up into the disc it was drawn to avoid.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, d = 22 + rnd() * 34;
    lobe(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 12 + rnd() * 18, 0.5 + rnd() * 0.5);
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  DUST = t;
  return t;
}

/**
 * The shock ring, as a decal on the flagstones.
 *
 * The moment of the shove had nothing you could point at: the dust clouds
 * take a third of a second to open out, and sprites thrown outward read as
 * weather rather than as a blow. A ring of dust lying FLAT on the stone and
 * running out across it is the one shape that lands in two frames at this
 * camera, and it is what the eye uses to place the impact.
 */
let SHOCK = null;
function shockTexture() {
  if (SHOCK) return SHOCK;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let s = 4410877;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  grd.addColorStop(0.80, 'rgba(255,255,255,0.62)');
  grd.addColorStop(0.93, 'rgba(255,255,255,0.30)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  // Chew the rim about, or it is a smoke ring from a machine.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = 44 + rnd() * 22, r = 5 + rnd() * 13;
    const l = g.createRadialGradient(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 0,
      64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r);
    l.addColorStop(0, `rgba(255,255,255,${0.4 + rnd() * 0.6})`);
    l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l;
    g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  SHOCK = t;
  return t;
}

/** One of those rings, thrown out from `at` and gone again. */
function shock(kit, when, at, { size = 3.4, seconds = 0.3, alpha = 0.8 } = {}) {
  stage(kit, when, seconds, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: shockTexture(), color: 0xd9c8a4, transparent: true, depthWrite: false, opacity: 0,
    }));
    m.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    m.position.copy(at).setY(at.y + 0.055);
    return {
      obj: m,
      tick: (t) => {
        m.scale.setScalar(0.7 + easeOut(t) * size);
        m.material.opacity = alpha * Math.min(1, t * 9) * (1 - t) ** 1.2;
      },
    };
  });
}

/**
 * The fracture, as a decal.
 *
 * Geometry cannot do this: a crack is a line one pixel wide at this camera and
 * the only thing that reads is its BRANCHING. Drawn dark with a pale lip on one
 * side, so the stone looks parted rather than painted, and left with a bare
 * centre — the middle of the break is where the slabs and the dust go.
 */
let CRACK = null;
function crackTexture() {
  if (CRACK) return CRACK;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  let s = 7712031;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const run = (x, y, a, len, w, depth) => {
    let px = x, py = y;
    for (let i = 0; i < 5 && w > 0.2; i++) {
      a += (rnd() - 0.5) * 1.15;
      const step = len * (0.5 + rnd() * 0.7);
      const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
      g.lineCap = 'round';
      // The lip is all but gone. Given any width it outran the dark core the
      // moment the decal was scaled down to a couple of hundred pixels, and
      // the break came out as a white spider's web sitting on the stone.
      g.strokeStyle = `rgba(250,244,230,${0.09 * w})`;
      g.lineWidth = Math.max(0.6, w * 1.5);
      g.beginPath(); g.moveTo(px - 3, py - 3); g.lineTo(nx - 3, ny - 3); g.stroke();
      g.strokeStyle = 'rgba(8,5,2,0.72)';
      g.lineWidth = Math.max(1.3, w * 8);      // wide at the break, thin at the tip
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (depth > 0 && rnd() < 0.5) run(nx, ny, a + (rnd() - 0.5) * 2.4, len * 0.6, w * 0.45, depth - 1);
      px = nx; py = ny;
      w *= 0.82;
      if (px < 6 || px > 250 || py < 6 || py > 250) break;
    }
  };
  // Irregularly spaced and of very different lengths. Eight even arms of one
  // length is a snowflake, and a snowflake is the one thing broken paving
  // never looks like.
  let a0 = rnd() * Math.PI * 2;
  for (let i = 0; i < 7; i++) {
    a0 += 0.45 + rnd() * 1.1;
    const near = rnd() < 0.4;
    run(128 + Math.cos(a0) * 16, 128 + Math.sin(a0) * 16, a0,
      (near ? 7 : 13) + rnd() * 7, 0.7 + rnd() * 0.5, near ? 1 : 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  CRACK = t;
  return t;
}

// Ground-up flagstone, catching what light the braziers give it.
//
// Half of these used to be DARKER than the flagstone they were drawn over, on
// the theory that a cloud needs a shaded side. It does — but a translucent
// sprite darker than its background subtracts almost nothing and simply
// disappears, which left only the pale grains on screen, one at a time, as
// separate white balls. Density is what makes a cloud; every grain has to
// register, so every grain is lighter than the stone.
const TAN = [0xe9d8b4, 0xd8c69f, 0xc6b389, 0xb29d74, 0x9c8763];
const pick = (a) => a[(Math.random() * a.length) | 0];

/** One grain of dust: where it starts, where it is going, how it dies. */
function grain(p, v, o = {}) {
  return {
    p: p.clone(), v: v.clone(),
    size: o.size ?? 0.45, grow: o.grow ?? 1.3, drag: o.drag ?? 3.0,
    fall: o.fall ?? 0.1, alpha: o.alpha ?? 0.6, delay: o.delay ?? 0,
    floor: o.floor ?? 0, col: o.col ?? pick(TAN),
    spin: Math.random() * Math.PI * 2,
  };
}

/**
 * Put a cloud on the table.
 *
 * Each grain slows under drag and SWELLS as it slows, because that is what
 * tells the eye it is a volume of air and not a picture of one; the fade is
 * long and slow at the end, which is the part that reads as weight. Dust that
 * vanishes on a linear ramp reads as a spark instead.
 *
 * Note what `v` means here: a grain only ever travels about v/drag in total,
 * so with drag at 3 a speed of 1 moves it a third of a unit and the whole
 * cloud sits still. That is what made the first dust a pale smudge parked over
 * the square — it was not faint, it was not GOING anywhere.
 */
function cloud(kit, when, seconds, grains) {
  if (!grains.length) return;
  stage(kit, when, seconds, () => {
    const tex = dustTexture();
    const grp = new THREE.Group();
    for (const gr of grains) {
      grp.add(new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: gr.col, transparent: true, depthWrite: false,
        rotation: gr.spin, opacity: 0,
      })));
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < grains.length; i++) {
          const gr = grains[i], s = grp.children[i];
          const a = (t - gr.delay) / Math.max(0.05, 1 - gr.delay);
          if (a <= 0) { s.material.opacity = 0; continue; }
          const d = (1 - Math.exp(-gr.drag * a)) / gr.drag;
          s.position.copy(gr.p).addScaledVector(gr.v, d);
          s.position.y -= gr.fall * a * a;
          if (s.position.y < gr.floor) s.position.y = gr.floor;
          s.scale.setScalar(gr.size * (1 + gr.grow * a));
          s.material.opacity = gr.alpha * Math.min(1, a * 6) * Math.max(0, 1 - a) ** 1.5;
        }
      },
    };
  });
}

/* ------------------------------------------------------------- the debris */

/**
 * Chips of flagstone, thrown and then BOUNCED.
 *
 * The first version let them fly a parabola and clamped them at floor height,
 * where they sat still and rotating — twelve pebbles hovering and spinning is
 * the single clearest way to make a heavy impact look weightless. They have to
 * arrive, skip, and come to rest.
 */
function grit(kit, when, seconds, from, dir, floor, opts = {}) {
  const {
    count = 14, speed = 2.2, up = 2.0, spread = 1.0, size = 0.1, delay = 0,
  } = opts;
  stage(kit, when, seconds, () => {
    // DARK. Chips the colour of dry flagstone were invisible twice over: they
    // matched the ground they came out of, and the dust they fly through is
    // pale. What reads is a dark thing crossing a light one.
    const mat = new THREE.MeshStandardMaterial({
      color: 0x564936, emissive: 0x1c1509, emissiveIntensity: 0.5,
      roughness: 1, flatShading: true, transparent: true,
    });
    const grp = new THREE.Group();
    const across = new THREE.Vector3(-dir.z, 0, dir.x);
    const rock = [];
    for (let i = 0; i < count; i++) {
      const r = size * (0.5 + Math.random());
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      // Some of them are slabs off the surface, not lumps: flattening a third
      // of them is what stops the debris reading as gravel.
      if (Math.random() < 0.4) m.scale.set(1.5, 0.4, 1.2);
      grp.add(m);
      // Thrown from a RING, not from the middle. Started at the centre they
      // spent the first half-second sitting inside the cocoon, and the cloth
      // came out looking like a basket with rubble in it.
      const a = Math.random() * Math.PI * 2;
      const rr = 0.45 + Math.random() * 0.65;
      rock.push({
        p: from.clone()
          .addScaledVector(dir, Math.cos(a) * rr)
          .addScaledVector(across, Math.sin(a) * rr)
          .setY(floor + 0.02 + Math.random() * 0.12),
        // Outward from where it sat, plus a hard shove down the line — and a
        // very wide spread of speeds, because launched at one speed they all
        // landed together in a dark heap a square along, which read as a
        // fallen tree lying on the flagstones.
        v: new THREE.Vector3(0, up * (0.45 + Math.random()), 0)
          .addScaledVector(dir, Math.cos(a) * spread + speed * (0.2 + Math.random() * 1.9))
          .addScaledVector(across, Math.sin(a) * spread + (Math.random() - 0.5) * spread),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .multiplyScalar(14),
        rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3),
        wake: delay * Math.random(),
      });
    }
    let prev = 0;
    return {
      obj: grp,
      tick: (t) => {
        const dt = Math.min(0.05, Math.max(0.001, (t - prev) * seconds));
        prev = t;
        for (let i = 0; i < rock.length; i++) {
          const r = rock[i], m = grp.children[i];
          if (t * seconds < r.wake) { m.visible = false; continue; }
          m.visible = true;
          r.v.y -= 13 * dt;
          r.p.addScaledVector(r.v, dt);
          if (r.p.y < floor) {
            r.p.y = floor;
            r.v.y *= -0.28;
            r.v.x *= 0.52; r.v.z *= 0.52;
            r.spin.multiplyScalar(0.45);
          }
          m.position.copy(r.p);
          r.rot.x += r.spin.x * dt; r.rot.y += r.spin.y * dt; r.rot.z += r.spin.z * dt;
          m.rotation.copy(r.rot);
        }
        // Gone while the dust is still up. Chips left lying on the flagstones
        // after it clears are litter, and litter is not weight.
        mat.opacity = t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1;
      },
    };
  });
}

/* ------------------------------------------------------------------ heave */

/** The wrap hauls them off their square: the ground heaves under them. */
export function heave(kit, when, at, dest, away, look) {
  const dir = dest ? dest.clone().sub(at).setY(0).normalize() : away.clone();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  // Debris rests just clear of the card's face. The flagstones are lower than
  // this, but at this camera the difference is a pixel, and anything left AT
  // table height disappears under the card it is supposed to have shifted.
  const FLOOR = at.y + 0.03;
  const LAND = 0.34;          // when the weight arrives on the far square
  const yaw = Math.atan2(-dir.z, dir.x);

  /* ------------------------------------------- the paving gives way behind */

  // The fracture goes down FIRST, because everything else is a consequence of
  // it: the slabs are pieces of this break and the dust comes out of it. It
  // snaps to full size in a couple of frames — a crack does not grow — and then
  // stays on the stone long after the bolt has gone.
  stage(kit, when, 1.5, () => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.95, CARD_W * 1.95),
      new THREE.MeshBasicMaterial({
        map: crackTexture(), transparent: true, depthWrite: false, opacity: 0,
      }),
    );
    m.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    // +0.055, not +0.02. A flat decal any closer than that to the card's face
    // loses the depth test against it and draws only on the stone AROUND the
    // card — so the break appears everywhere except the square it happened on.
    m.position.copy(at).setY(at.y + 0.055);
    return {
      obj: m,
      tick: (t) => {
        m.scale.setScalar(0.82 + easeOut(Math.min(1, t * 14)) * 0.18);
        // Never all the way to 1: at full strength it stopped being a crack
        // in the stone and became a black star painted over the square.
        m.material.opacity = 0.62 * Math.min(1, t * 22) * (t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1);
      },
    };
  });

  // Broken ground is slabs at odds with each other, hinged and tipping the way
  // the force went. Five of them laid nearly flat were five blank rectangles
  // strewn round the square — a slab that has barely moved shows only its lit
  // top face, which is a panel, not a stone. Four, bigger and pushed well
  // over, read instead: the tilt puts a lit face against a shadowed edge, and
  // at this size that is the whole of the form. All of them are BEHIND the
  // victim, on the caster's side, because that is what makes the ground the
  // thing doing the shoving.
  const SLABS = [
    { along: -0.66, across: -0.14, w: 1.15, d: 0.72, tip: 1.02, wake: 0.00 },
    { along: -0.40, across: 0.74, w: 0.74, d: 0.54, tip: 0.86, wake: 0.04 },
    { along: -0.30, across: -0.86, w: 0.66, d: 0.50, tip: 0.94, wake: 0.07 },
    { along: 0.34, across: 0.80, w: 0.46, d: 0.36, tip: 0.62, wake: 0.11 },
  ];
  stage(kit, when, 1.05, () => {
    const grp = new THREE.Group();
    const hinges = [];
    const mats = [];
    for (const s of SLABS) {
      // Its own material per slab. Sharing one made four identical tan boxes,
      // and four identical anything reads as a prop set rather than as one
      // piece of ground that came apart.
      const mat = new THREE.MeshStandardMaterial({
        map: slabTexture(), color: new THREE.Color().setHSL(0.1, 0.18, 0.44 + Math.random() * 0.16),
        emissive: 0x1a1309, emissiveIntensity: 0.6,
        roughness: 1, flatShading: true, transparent: true,
      });
      mats.push(mat);
      const outer = new THREE.Group();
      outer.position.copy(at)
        .addScaledVector(dir, s.along * CARD_W)
        .addScaledVector(side, s.across * CARD_W);
      outer.rotation.y = Math.atan2(dir.x, dir.z) + (Math.random() - 0.5) * 0.9;
      const pivot = new THREE.Group();
      // Rolled as well as tipped, so the break has no two edges parallel.
      pivot.rotation.z = (Math.random() - 0.5) * 0.5;
      // A box is a crate. Shoving every vertex about by a few centimetres
      // costs nothing and, with flat shading, is the whole difference between
      // a broken flagstone and a packing case.
      const geo = new THREE.BoxGeometry(s.w, 0.19, s.d);
      const vp = geo.attributes.position.array;
      for (let v = 0; v < vp.length; v++) vp[v] += (Math.random() - 0.5) * 0.09;
      const slab = new THREE.Mesh(geo, mat);
      slab.position.z = s.d * 0.5;          // the hinge is the slab's back edge
      pivot.add(slab);
      outer.add(pivot);
      grp.add(outer);
      hinges.push({ outer, pivot, s, base: FLOOR - 0.30 });
    }
    return {
      obj: grp,
      tick: (t) => {
        for (const h of hinges) {
          const u = Math.max(0, (t - h.s.wake) / 0.13);
          // Up fast, held, then dropped FAST. Letting them subside gently was
          // the difference between paving and scenery: stone this size comes
          // back down as quickly as it went up.
          const up = easeOut(Math.min(1, u));
          const drop = t > 0.46 ? easeIn(Math.min(1, (t - 0.46) / 0.26)) : 0;
          const k = up * (1 - drop);
          h.outer.position.y = h.base + k * 0.30;
          h.pivot.rotation.x = -k * h.s.tip;
        }
        const o = t > 0.74 ? 1 - (t - 0.74) / 0.26 : 1;
        for (const m of mats) m.opacity = o;
      },
    };
  });

  // What the slabs kick up when they come back down. The ending used to be one
  // event and then a fade; this is a second, smaller beat half a second in,
  // which is what says the stone that moved had weight of its own.
  const settle = [];
  for (const sl of SLABS) {
    for (let i = 0; i < 4; i++) {
      settle.push(grain(
        at.clone().addScaledVector(dir, sl.along * CARD_W + (Math.random() - 0.5) * 0.5)
          .addScaledVector(side, sl.across * CARD_W + (Math.random() - 0.5) * 0.5)
          .setY(FLOOR),
        new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.5 + Math.random() * 0.6,
          (Math.random() - 0.5) * 2.2),
        { size: 0.4 + Math.random() * 0.3, grow: 1.6, drag: 3.2, alpha: 0.2 + Math.random() * 0.16,
          floor: FLOOR, delay: Math.random() * 0.15 },
      ));
    }
  }
  cloud(kit, when + 0.5, 0.95, settle);

  /* ------------------------------------------------- the burst at their feet */

  // It starts on a RING round them and moves outward. Seeded at the centre it
  // was a handful of pale blobs sitting INSIDE the cocoon, where the wrap hid
  // half of it and the rest read as something the cloth was holding.
  const burst = [];
  for (let i = 0; i < 52; i++) {
    const a = (i / 52) * Math.PI * 2 + Math.random() * 0.6;
    const r = 0.55 + Math.random() * 0.75;
    burst.push(grain(
      at.clone().addScaledVector(dir, Math.cos(a) * r).addScaledVector(side, Math.sin(a) * r)
        .setY(FLOOR + Math.random() * 0.1),
      new THREE.Vector3(0, 0.5 + Math.random() * 1.4, 0)
        .addScaledVector(dir, Math.cos(a) * (1.6 + Math.random() * 1.6) + 1.5 + Math.random() * 2.6)
        .addScaledVector(side, Math.sin(a) * (1.6 + Math.random() * 1.8)),
      { size: 0.7 + Math.random() * 0.6, grow: 1.7, drag: 2.3, alpha: 0.38 + Math.random() * 0.26,
        floor: FLOOR, delay: Math.random() * 0.06 },
    ));
  }
  cloud(kit, when, 1.1, burst);

  // The crack of it. The burst above takes a third of a second to open out,
  // which left the actual MOMENT of the shove with nothing on screen but four
  // stones popping up — so this goes out flat and fast and is gone before the
  // dust has finished lifting, the way the skirt of a real impact is.
  const skirt = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
    skirt.push(grain(
      at.clone().addScaledVector(dir, Math.cos(a) * 0.4).addScaledVector(side, Math.sin(a) * 0.4)
        .setY(FLOOR),
      new THREE.Vector3(0, 0.35 + Math.random() * 0.4, 0)
        .addScaledVector(dir, Math.cos(a) * 9 + 3)
        .addScaledVector(side, Math.sin(a) * 9),
      { size: 0.52 + Math.random() * 0.4, grow: 2.6, drag: 8.5, alpha: 0.5 + Math.random() * 0.3,
        floor: FLOOR },
    ));
  }
  cloud(kit, when, 0.34, skirt);
  grit(kit, when, 1.3, at, dir, FLOOR, { count: 22, speed: 2.8, up: 1.9, spread: 1.4, size: 0.095 });

  shock(kit, when, at, { size: 3.3, seconds: 0.32 });
  ring(kit, when, at, 0xa87a40, { size: 2.4, seconds: 0.34, thick: 0.24 });
  // The braziers are the only warm thing on this table, so the flash that
  // goes with the break is the bolt's own colour rather than white: it puts
  // the light of the bolt on the stone it has just broken.
  glowAt(kit, when, at.clone().setY(at.y + 0.5), look.colour, { power: 12, seconds: 0.34 });

  if (!dest) return;

  /* --------------------------------------------------- dragged to the square */

  // Scuff on the stone between the two squares. This is the one thing on
  // screen that states the DIRECTION outright, and it is laid down a piece at
  // a time so the mark travels with them instead of appearing all at once.
  // Pale dust-coloured smears washed out against lit flagstone and could not
  // be seen at all, so the mark is DARK — stone scraped bare and shadowed —
  // which is also what a body dragged over paving actually leaves.
  stage(kit, when + 0.02, 1.5, () => {
    const tex = dustTexture();
    const grp = new THREE.Group();
    const marks = [];
    for (let i = 0; i < 10; i++) {
      const k = i / 9;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: tex, color: 0x2e251a, transparent: true, depthWrite: false, opacity: 0,
      }));
      // Laid flat, then spun in its own plane onto the line of the shove.
      m.rotation.set(-Math.PI / 2, 0, yaw + (Math.random() - 0.5) * 0.25);
      m.position.copy(at).lerp(dest, k * 1.02)
        .addScaledVector(side, (Math.random() - 0.5) * 0.85)
        .setY(at.y + 0.055);          // clear of a card's face — see the crack
      m.scale.set(1.0 + Math.random() * 1.0, 0.34 + Math.random() * 0.34, 1);
      grp.add(m);
      marks.push({ wake: 0.02 + k * 0.26, alpha: 0.34 + Math.random() * 0.26 });
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < marks.length; i++) {
          const mk = marks[i];
          const a = Math.max(0, (t - mk.wake) / (1 - mk.wake));
          grp.children[i].material.opacity =
            mk.alpha * Math.min(1, a * 9) * Math.max(0, 1 - a) ** 1.2;
        }
      },
    };
  });

  const wake = [];
  for (let i = 0; i < 40; i++) {
    const k = 0.1 + Math.random() * 0.92;
    wake.push(grain(
      at.clone().lerp(dest, k).addScaledVector(side, (Math.random() - 0.5) * 1.9).setY(FLOOR),
      side.clone().multiplyScalar((Math.random() - 0.5) * 2.4)
        .addScaledVector(dir, 0.7 + Math.random() * 1.6)
        .setY(0.5 + Math.random() * 1.1),
      { size: 0.62 + Math.random() * 0.6, grow: 1.4, drag: 2.4, alpha: 0.22 + Math.random() * 0.2,
        floor: FLOOR, delay: k * 0.26 },
    ));
  }
  cloud(kit, when + 0.03, 1.25, wake);

  /* ------------------------------------------------------- and they land */

  // The beat that has to land, so it is the widest and the slowest of them:
  // the dust goes OUT along the ground rather than up, and it is still hanging
  // there when everything else has finished.
  const hit = [];
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + Math.random() * 0.4;
    const r = 3.0 + Math.random() * 3.0;
    hit.push(grain(
      dest.clone().addScaledVector(dir, (Math.random() - 0.5) * 0.6)
        .addScaledVector(side, (Math.random() - 0.5) * 0.6)
        .setY(FLOOR + Math.random() * 0.08),
      new THREE.Vector3(Math.cos(a) * r, 0.2 + Math.random() * 0.7, Math.sin(a) * r)
        .addScaledVector(dir, 0.9 * Math.random()),
      { size: 0.62 + Math.random() * 0.62, grow: 2.0, drag: 1.9, fall: 0.06,
        alpha: 0.4 + Math.random() * 0.26, floor: FLOOR, delay: Math.random() * 0.07 },
    ));
  }
  for (let i = 0; i < 10; i++) {
    hit.push(grain(
      dest.clone().addScaledVector(side, (Math.random() - 0.5) * 0.8).setY(FLOOR + 0.04),
      new THREE.Vector3((Math.random() - 0.5) * 1.6, 2.4 + Math.random() * 2.0,
        (Math.random() - 0.5) * 1.6),
      { size: 0.46 + Math.random() * 0.4, grow: 2.2, drag: 3.0, fall: 0.5,
        alpha: 0.42, floor: FLOOR },
    ));
  }
  cloud(kit, when + LAND, 1.2, hit);

  // The arrival gets its own skirt, for the same reason the shove did: the
  // landing cloud takes a third of a second to open out, and without this the
  // beat the whole ending builds to had no frame you could point at.
  const thud = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
    thud.push(grain(
      dest.clone().addScaledVector(dir, Math.cos(a) * 0.45)
        .addScaledVector(side, Math.sin(a) * 0.45).setY(FLOOR),
      new THREE.Vector3(0, 0.3 + Math.random() * 0.4, 0)
        .addScaledVector(dir, Math.cos(a) * 10 + 1.5)
        .addScaledVector(side, Math.sin(a) * 10),
      { size: 0.55 + Math.random() * 0.45, grow: 2.6, drag: 8.5, alpha: 0.5 + Math.random() * 0.3,
        floor: FLOOR },
    ));
  }
  cloud(kit, when + LAND, 0.36, thud);
  grit(kit, when + LAND, 1.15, dest, dir, FLOOR,
    { count: 18, speed: 1.0, up: 1.6, spread: 2.2, size: 0.09 });

  shock(kit, when + LAND, dest, { size: 4.0, seconds: 0.38 });
  ring(kit, when + LAND, dest, 0xa87a40, { size: 3.2, seconds: 0.44, thick: 0.26 });
  glowAt(kit, when + LAND, dest.clone().setY(dest.y + 0.45), look.colour,
    { power: 15, seconds: 0.46 });
}
