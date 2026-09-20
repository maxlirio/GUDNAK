// THE FIRE BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.
//
// The shape of it, in the order you see it: the WRAP catches — seams of flame
// run round the turns of cloth from three points and meet — then the fire
// takes hold of what is inside and climbs, peaking as the bolt reels itself
// back out through the blaze; then it burns down to a bed of coals under its
// own smoke, and the stone keeps the mark.
//
// The first pass was 26 additive blobs given one life each over 1.15s. Two
// things were wrong with it and both are fixed here. One life each means the
// whole fire is a single PULSE — it swells and dies and never boils, because
// no sprite is ever reborn; every particle below is recycled, so the fire is
// continuously fed and the look of it comes from the envelope, not from the
// particles running out. And round white-hot blobs only ever make a glowing
// ball: fire needs a silhouette with a point on it, and a colour ramp whose
// hot end is NOT white (see RAMP).

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt } from '../cloth-kit.js';

/* ------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold() disposes materials and a
// material never disposes its map, so the second Fire Bolt of a game must not
// pay for canvas work again.
const TEXES = new Map();
function tex(key, paint, size = 128) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

/**
 * A flame TONGUE, drawn white and tinted per particle, tip at the top.
 *
 * Every sprite that uses this is anchored at its own root (`center.y ≈ 0`), so
 * it licks UP the screen from wherever it was born without any billboard maths
 * and without caring which side of the table the camera is on.
 */
const tongueTex = () => tex('tongue', (g) => {
  g.filter = 'blur(7px)';
  g.beginPath();
  g.moveTo(64, 6);
  g.bezierCurveTo(86, 46, 94, 74, 88, 96);      // slender, and not symmetrical:
  g.bezierCurveTo(78, 120, 48, 122, 40, 100);   // a tongue that leans reads as
  g.bezierCurveTo(32, 74, 44, 44, 64, 6);       // moving air, a lozenge does not
  g.closePath();
  // The heat gradient is drawn INTO the tongue rather than left to the tint.
  // A sprite carries one colour, so tinted flames came out as flat orange
  // lozenges — every tongue the same temperature from root to tip, which is
  // the one thing a flame never is. Baked in, each tongue cools along its own
  // length and the per-particle tint only says how old the whole tongue is.
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(196,52,10,0.10)');      // the tip is nearly gone
  grd.addColorStop(0.3, 'rgba(238,104,22,0.58)');
  grd.addColorStop(0.62, 'rgba(255,172,58,0.96)');
  grd.addColorStop(0.9, 'rgba(255,232,168,1)');     // white-hot at the root
  grd.addColorStop(1, 'rgba(255,240,196,0.32)');
  g.fillStyle = grd;
  g.fill();
});

/** The root of a fire is round: the lumpy base the tongues stand out of. */
const rootTex = () => tex('root', (g) => {
  const lobe = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.45, `rgba(255,255,255,${a * 0.42})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.7;
    lobe(64 + Math.cos(a) * 19, 64 + Math.sin(a) * 14, 30, 0.34);
  }
  lobe(64, 66, 52, 0.5);
});

/** A hard little dot with a halo — the embers, which outlive the flames. */
const emberTex = () => tex('ember', (g) => {
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.14, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.32, 'rgba(255,255,255,0.2)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
}, 64);

/**
 * Smoke: soft, lumpy, and eaten away at the edges.
 *
 * Smoke is the one thing here that is NOT additive — additive smoke is a grey
 * glow, which is a contradiction. It has to take light OUT, so it is drawn
 * with ordinary blending in a dark warm grey and kept thin.
 */
const smokeTex = () => tex('smoke', (g) => {
  const lobe = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.55, `rgba(255,255,255,${a * 0.5})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  };
  lobe(64, 64, 62, 0.62);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    lobe(64 + Math.cos(a) * 22, 64 + Math.sin(a) * 22, 30, 0.3);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 40 + Math.random() * 22;
    g.beginPath();
    g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 11 + Math.random() * 13, 0, Math.PI * 2);
    g.fill();
  }
});

/** What is left burning on the card: coals seen through their own ash. */
const coalTex = () => tex('coal', (g) => {
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.75, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  // Ash lying over the coals, so the bed is broken up instead of being one
  // even disc of light — a disc reads as a decal, a broken bed reads as fire.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() ** 0.6 * 60;
    g.beginPath();
    g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 4 + Math.random() * 12, 0, Math.PI * 2);
    g.fill();
  }
});

/** The mark on the stone: a blotch with a torn edge, never a circle. */
const scorchTex = () => tex('scorch', (g) => {
  // Nearly flat, then a fast torn edge. A soft radial falloff left the card's
  // four corners unburnt and legible while the middle was black, which reads
  // as a smudge ON a card rather than a card that has burnt.
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 66);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.72, 'rgba(255,255,255,0.97)');
  grd.addColorStop(0.9, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + Math.random() * 0.3;
    const r = 56 + Math.random() * 20;
    g.beginPath();
    g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 9 + Math.random() * 15, 0, Math.PI * 2);
    g.fill();
  }
});

/* --------------------------------------------------------------- colour */

// Root to tip. The hot end is deliberately not white and its blue channel is
// deliberately tiny: the renderer tone-maps with ACES, so three overlapping
// additive sprites sum past 1.0 in every channel and a plume built on
// (1,1,1) bleaches to a white smear with an orange fringe — which is exactly
// what the first pass of this file looked like at the table's camera. Held
// under 0.25, blue never reaches white however deep the stack gets, so the
// core clips to yellow-orange instead.
const RAMP = [
  [0.00, 1.00, 0.72, 0.24],
  [0.13, 1.00, 0.50, 0.10],
  [0.36, 0.96, 0.26, 0.03],
  [0.64, 0.56, 0.09, 0.01],
  [1.00, 0.12, 0.01, 0.00],
];
function heatAt(u, out) {
  let i = 1;
  while (i < RAMP.length - 1 && u > RAMP[i][0]) i++;
  const a = RAMP[i - 1], b = RAMP[i];
  const k = Math.min(1, Math.max(0, (u - a[0]) / (b[0] - a[0])));
  out.setRGB(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
}

const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * A repeatable number per particle PER LIFE.
 *
 * Recycled particles are the whole trick here, and a particle reborn in the
 * same place with the same height is a blinking sprite rather than a fire. So
 * every property that should differ between one life and the next is drawn
 * from this instead of from Math.random(), which would re-roll every frame.
 */
function hash(a, b, salt) {
  let x = (a * 374761393 + b * 668265263 + salt * 2246822519) >>> 0;
  x = ((x ^ (x >>> 13)) * 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/* ---------------------------------------------------------------- timing */

const SPAN = 1.55;        // the fire itself, from first lick to last flame

/**
 * How much fire there is, in seconds since it caught.
 *
 * Everything — flame count, flame height, the light, the coals — is hung off
 * this one curve, because a fire whose parts each have their own timing does
 * not look like one fire. It is slow to start on purpose: the cloth is still
 * on them for the first fifth of a second and the flame has to look like it is
 * spreading over fabric before it becomes a blaze.
 */
function arc(s) {
  if (s < 0.32) return 0.05 + 0.31 * easeIn(s / 0.32);
  if (s < 0.70) return 0.36 + 0.64 * easeOut((s - 0.32) / 0.38);
  if (s < 0.96) return 1;
  return Math.max(0, 1 - (s - 0.96) / 0.52);
}

/* --------------------------------------------------------------- the wrap */

// The cocoon the cloth leaves round them: ../cloth-kit.js winds `turns` of
// cloth up a dome of this radius and rise, then cinches it in. The seams of
// flame below have to run along THAT, so the shape is mirrored here. Only the
// phase is unknown from in here (it depends on which way the bolt came from),
// and a helix of three full turns covers every angle anyway, so it does not
// matter which spoke the fire starts on.
const WRAP_R = Math.min(CARD_W, CARD_H) * 0.52 * 0.88;
const WRAP_RISE = 0.9;
const WRAP_TURNS = 3;

function onWrap(at, w, phase, out) {
  const a = phase + w * Math.PI * 2 * WRAP_TURNS;
  const taper = Math.sqrt(Math.max(0.04, 1 - w * w * 0.92));
  return out.set(
    at.x + Math.cos(a) * WRAP_R * taper,
    at.y - 0.01 + WRAP_RISE * w,
    at.z + Math.sin(a) * WRAP_R * taper,
  );
}

/* ------------------------------------------------------------------ parts */

/**
 * The cloth catching: flame running along the turns from three points.
 *
 * Ignition time is distance ALONG THE CLOTH from the nearest seed, not
 * distance through space, so the fire crawls round the wrap the way a lit
 * edge crawls across paper rather than blooming as a sphere.
 */
function catching(kit, when, at) {
  stage(kit, when, 0.62, () => {
    const grp = new THREE.Group();
    const phase = Math.random() * Math.PI * 2;
    const seeds = [0.06, 0.34 + rnd(-0.06, 0.06), 0.72 + rnd(-0.06, 0.06)];
    const licks = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < 30; i++) {
      const w = (i + rnd(0.1, 0.9)) / 30;
      let d = 9;
      for (const s of seeds) d = Math.min(d, Math.abs(w - s));
      const m = new THREE.SpriteMaterial({
        map: tongueTex(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0,
      });
      const s = new THREE.Sprite(m);
      s.center.set(0.5, 0.08);
      s.scale.set(0.01, 0.01, 1);
      grp.add(s);
      onWrap(at, w, phase, p);
      licks.push({
        s, m, x: p.x, y: p.y, z: p.z,
        born: 0.01 + d * 1.5 + rnd(0, 0.05),
        life: rnd(0.26, 0.42),
        h: (0.3 + 0.34 * (1 - w)) * rnd(0.8, 1.45),
        lean: rnd(-0.06, 0.06),
      });
    }
    const tint = new THREE.Color();
    return {
      obj: grp,
      tick: (t) => {
        const sec = t * 0.62;
        for (const f of licks) {
          const u = (sec - f.born) / f.life;
          if (u <= 0 || u >= 1) { f.m.opacity = 0; continue; }
          // up fast, then burning down — a lick is at its tallest early
          const k = u < 0.28 ? u / 0.28 : 1 - ((u - 0.28) / 0.72) * 0.8;
          f.s.position.set(f.x + f.lean * u, f.y + 0.03 * u, f.z);
          f.s.scale.set(f.h * 0.62 * (0.5 + 0.5 * k), f.h * k, 1);
          // white-hot: the cloth under it is already glowing from the grip,
          // so a merely orange lick vanished into it
          heatAt(u * 0.55, tint);
          f.m.color.copy(tint);
          f.m.opacity = 1 * (u < 0.18 ? u / 0.18 : 1 - (u - 0.18) / 0.82);
        }
      },
    };
  });
}

/**
 * The fire proper: a bed of roots with tongues standing out of it.
 *
 * Tongues are born round an ellipse the size of the card, drawn inward as they
 * climb (flames converge — a column of parallel flames is a hedge), and each
 * one is recycled two or three times across the span with a fresh angle,
 * height and radius each life. `rank` is what makes it look like it SPREADS:
 * a tongue only exists once the fire is big enough to have got that far, so
 * there are four licks at the start and forty at the peak, from one array.
 */
function pyre(kit, when, at) {
  stage(kit, when, SPAN, () => {
    const grp = new THREE.Group();
    const N = 58, ROOTS = 11;
    const parts = [];
    for (let i = 0; i < N + ROOTS; i++) {
      const root = i >= N;
      const m = new THREE.SpriteMaterial({
        map: root ? rootTex() : tongueTex(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0,
      });
      const s = new THREE.Sprite(m);
      s.center.set(0.5, root ? 0.5 : 0.04);
      s.scale.set(0.01, 0.01, 1);
      grp.add(s);
      parts.push({
        s, m, i, root,
        // Rank is biased low so the fire always has a few tongues to catch
        // with, and the last of them only turn up at the peak.
        rank: root ? (i - N) / ROOTS * 0.45 : ((i / N) ** 1.35) * 0.95,
        off: rnd(-0.5, 0.0),                     // a staggered first life
        life: root ? rnd(0.34, 0.5) : rnd(0.32, 0.55),
        // Every third tongue is squat and wide. All spires and the fire is a
        // row of spearheads with daylight between them; the short ones are
        // what fills in and gives it a body to stand on.
        h: root ? rnd(0.3, 0.46) : (i % 3 === 0 ? rnd(0.44, 0.78) : rnd(0.86, 1.62)),
        w: i % 3 === 0 ? rnd(0.62, 0.92) : rnd(0.3, 0.44),
        lift: rnd(0.55, 1.05),
      });
    }
    const tint = new THREE.Color();
    return {
      obj: grp,
      tick: (t) => {
        const sec = t * SPAN;
        const heat = arc(sec);
        for (const f of parts) {
          if (f.rank > heat) { f.m.opacity = 0; continue; }
          const x = (sec - f.off) / f.life;
          const cyc = Math.floor(x);
          const u = x - cyc;
          if (x < 0) { f.m.opacity = 0; continue; }
          const a = hash(f.i, cyc, 1) * Math.PI * 2;
          // sqrt so the footprint fills evenly instead of crowding the rim
          const r = Math.sqrt(hash(f.i, cyc, 2)) * (f.root ? 0.52 : 0.95);
          const tall = f.h * (0.62 + 0.55 * hash(f.i, cyc, 3)) * (0.5 + 0.5 * heat);
          const bx = at.x + Math.cos(a) * r * CARD_W * 0.5;
          const bz = at.z + Math.sin(a) * r * CARD_H * 0.5;
          const k = u < 0.26 ? u / 0.26 : 1 - ((u - 0.26) / 0.74) * 0.72;

          if (f.root) {
            f.s.position.set(bx, at.y + 0.1 + 0.1 * u, bz);
            f.s.scale.setScalar(tall * (0.45 + 0.9 * k));
            heatAt(0.05 + u * 0.35, tint);
            f.m.color.copy(tint);
            f.m.opacity = 0.42 * heat * Math.sin(Math.PI * Math.min(1, u) ** 0.7);
          } else {
            const climb = u ** 1.35;
            f.s.position.set(
              // pulled toward the middle as it climbs, and shoved about by its
              // own draught, so no two tongues stand in the same column
              bx + (at.x - bx) * climb * 0.34 + Math.sin(u * 6.5 + a) * 0.07 * tall,
              at.y + 0.09 + f.lift * tall * climb,
              bz + (at.z - bz) * climb * 0.34 + Math.cos(u * 5.5 + a) * 0.07 * tall,
            );
            f.s.scale.set(tall * f.w * (0.46 + 0.54 * k), tall * k, 1);
            // The tint now only ages the whole tongue — the root-to-tip
            // gradient is in the map — so it stays near the hot end of the
            // ramp and lets the texture do the cooling.
            heatAt(0.04 + u ** 0.85 * 0.62, tint);
            f.m.color.copy(tint);
            f.m.opacity = 0.92 * (u < 0.14 ? u / 0.14 : 1 - (u - 0.14) / 0.86);
          }
        }
      },
    };
  });
}

/**
 * Embers, carried up out of the fire on its own draught.
 *
 * Sprites, not a Points cloud. A cloud is the cheaper thing and it is what
 * this started as, but gl_PointSize is capped by the driver and sits on
 * whatever the page's pixel ratio happens to be, and under SwiftShader the
 * embers came out sub-pixel and could not be found in any shot. Thirty
 * sprites cost nothing next to the flames and are the same size everywhere.
 */
function embers(kit, when, at) {
  const LIFE = 1.55;
  stage(kit, when, LIFE, () => {
    const N = 30;
    const grp = new THREE.Group();
    const em = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.SpriteMaterial({
        map: emberTex(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0,
      });
      const sp = new THREE.Sprite(m);
      sp.scale.setScalar(0.01);
      grp.add(sp);
      em.push({
        s: sp, m, i, off: rnd(-0.7, 0.1), life: rnd(0.62, 1.0),
        // Thrown hard. At the first, gentler speed every ember spent its
        // whole life inside the flames, where a bright dot is invisible —
        // an ember only reads once it is clear of the fire that made it.
        up: rnd(3.6, 6.4), size: rnd(0.12, 0.23), flick: rnd(13, 29),
        rank: (i / N) ** 1.2 * 0.85,
      });
    }
    const tint = new THREE.Color();
    return {
      obj: grp,
      tick: (t) => {
        const sec = t * LIFE;
        // embers keep coming off the coals long after the flames have gone
        const heat = Math.max(arc(sec), sec > 0.9 ? 0.34 * (1 - (sec - 0.9) / 0.65) : 0);
        for (const e of em) {
          if (e.rank > heat) { e.m.opacity = 0; continue; }
          const x = (sec - e.off) / e.life;
          const cyc = Math.floor(x);
          const u = x - cyc;
          if (x < 0) { e.m.opacity = 0; continue; }
          const ang = hash(e.i, cyc, 5) * Math.PI * 2;
          const r = Math.sqrt(hash(e.i, cyc, 6)) * 0.55;
          const age = u * e.life;
          // Rising, slowing, and wandering: an ember that flies a straight
          // line is a tracer round. The drag term is what makes it hang.
          e.s.position.set(
            at.x + Math.cos(ang) * r + Math.sin(age * 3.1 + ang) * 0.3 * u,
            at.y + 0.1 + e.up * age * (1 - 0.3 * u),
            at.z + Math.sin(ang) * r + Math.cos(age * 2.7 + ang) * 0.3 * u,
          );
          e.s.scale.setScalar(e.size * (1 - 0.3 * u));
          // flicker hard, and cool from yellow to a dull red as they climb
          const glow = (0.62 + 0.38 * Math.sin(age * e.flick + e.i)) * (1 - u) ** 0.8;
          tint.setRGB(1, 0.55 - 0.42 * u, 0.14 - 0.13 * u);
          e.m.color.copy(tint);
          e.m.opacity = glow * (u < 0.1 ? u / 0.1 : 1);
        }
      },
    };
  });
}

/**
 * Smoke. It lags the fire, thickens as the flames fall away, and leans off on
 * one bearing — smoke that rises straight up has no air around it.
 */
function smoke(kit, when, at) {
  const LIFE = 1.7;
  stage(kit, when, LIFE, () => {
    const grp = new THREE.Group();
    const drift = Math.random() * Math.PI * 2;
    const dx = Math.cos(drift) * 0.62, dz = Math.sin(drift) * 0.62;
    const parts = [];
    for (let i = 0; i < 20; i++) {
      const m = new THREE.SpriteMaterial({
        map: smokeTex(), transparent: true, depthWrite: false, opacity: 0,
        color: 0x000000,
      });
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.01);
      grp.add(s);
      parts.push({
        s, m, i, off: rnd(-0.55, 0.15), life: rnd(0.85, 1.35),
        rise: rnd(0.62, 1.15), size: rnd(0.55, 1.0), rank: (i / 20) ** 1.2 * 0.8,
      });
    }
    const tint = new THREE.Color();
    return {
      obj: grp,
      tick: (t) => {
        const sec = t * LIFE;
        const heat = arc(sec);
        // The column is thickest just AFTER the fire tops out, and the last of
        // it is still going up when everything else has finished.
        const body = Math.min(1, sec / 0.45) * (sec < 1.1 ? 1 : Math.max(0, 1 - (sec - 1.1) / 0.6));
        for (const f of parts) {
          if (f.rank > Math.max(heat, 0.55 * body)) { f.m.opacity = 0; continue; }
          const x = (sec - f.off) / f.life;
          const cyc = Math.floor(x);
          const u = x - cyc;
          if (x < 0) { f.m.opacity = 0; continue; }
          const a = hash(f.i, cyc, 7) * Math.PI * 2;
          const r = Math.sqrt(hash(f.i, cyc, 8)) * 0.5;
          // Born ABOVE the flames and leaning off hard from the first frame.
          // Rising out of the roots with only a slow lean, smoke spends its
          // life directly over the fire, and a grey sprite in front of a
          // flame is a grey flame — the whole plume went the colour of ash.
          f.s.position.set(
            at.x + Math.cos(a) * r + dx * (0.35 + u) * u + Math.sin(u * 2.4 + a) * 0.14,
            at.y + 0.5 + f.rise * (0.4 + 0.9 * heat) * u ** 0.8 + 0.5 * u,
            at.z + Math.sin(a) * r + dz * (0.35 + u) * u + Math.cos(u * 2.1 + a) * 0.14,
          );
          // it only swells: smoke never gets denser than the moment it leaves
          f.s.scale.setScalar(f.size * (0.4 + 1.5 * u));
          // lit from underneath while it is still in the fire, cold above
          // Dark smoke on a dark table is nothing at all — the first cut of
          // this was invisible in every shot. What you actually see of smoke
          // at night is the underside of it catching the fire, so the lit end
          // is pushed well up and it falls off fast as the column climbs out
          // of the light.
          const lit = Math.max(0, 1 - u * 1.6) * (0.35 + 0.65 * heat);
          tint.setRGB(0.09 + 1.15 * lit, 0.07 + 0.62 * lit, 0.055 + 0.2 * lit);
          f.m.color.copy(tint);
          // thin while the fire is loud, and thickest once it has gone quiet
          f.m.opacity = 0.5 * body * Math.sin(Math.PI * u ** 0.55) * (1.05 - 0.4 * heat);
        }
      },
    };
  });
}

/**
 * The card's own light, and what is left burning on it.
 *
 * The bed of coals sits just ABOVE the card face rather than under it: the
 * fighter burning here should be lit by their own fire, and the first version
 * of this decal was drawn at table height and hidden under the very card it
 * was meant to mark.
 */
function coals(kit, when, at) {
  const LIFE = 1.9;
  stage(kit, when, LIFE, () => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 0.96, CARD_H * 0.96),
      new THREE.MeshBasicMaterial({
        map: coalTex(), color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI;
    m.position.copy(at).setY(at.y + 0.072);
    const tint = new THREE.Color();
    return {
      obj: m,
      tick: (t) => {
        const sec = t * LIFE;
        const heat = arc(sec);
        // The coals outlast the flames and cool as they go: white-hot under
        // the blaze, a dull red bed by the end.
        //
        // This glow, not the char, is what carries the last half second. A
        // charred plane is a DARK thing on a card that by then has no fire
        // lighting it, and at this camera that is nearly no change at all —
        // every late shot came back looking like an untouched card. Light is
        // the only thing that reads on a table lit by two braziers, so the
        // ending is a bed of embers going out rather than a black mark.
        const cool = Math.min(1, Math.max(0, (sec - 0.55) / 1.35));
        heatAt(0.04 + cool * 0.6, tint);
        m.material.color.copy(tint);
        const bed = 0.85 * Math.min(1, sec / 0.5) * (1 - cool) ** 0.8;
        m.material.opacity = Math.max(heat * 0.72, bed)
          * (0.86 + 0.14 * Math.sin(sec * 21) * (0.4 + 0.6 * heat));
        m.scale.setScalar(0.55 + 0.45 * Math.min(1, sec * 3));
      },
    };
  });
}

/* ------------------------------------------------------------------ bolt */

/** They burn up inside the cloth. */
export function burn(kit, when, at, look) {
  catching(kit, when, at);
  pyre(kit, when + 0.03, at);
  embers(kit, when + 0.2, at);
  smoke(kit, when + 0.16, at);
  coals(kit, when + 0.12, at);

  // The first breath: the wrap goes up with a thump of hot air.
  puff(kit, when + 0.02, at, look.glow,
    { count: 12, spread: 1.0, rise: 1.5, seconds: 0.5, size: 0.2, drag: 1.4, y: 0.55 });
  ring(kit, when, at, 0xffb45a, { size: 2.2, seconds: 0.55 });

  // The light. Hung off the same curve as the flames so the table brightens as
  // the fire climbs instead of flashing once at the start — that mismatch was
  // the loudest thing wrong with the first pass. The gutter is two sines and a
  // little noise rather than pure Math.random(), which strobes.
  stage(kit, when, SPAN + 0.35, () => {
    const l = new THREE.PointLight(0xff8b33, 0, 7.4, 2);
    l.position.copy(at).setY(at.y + 0.45);
    return {
      obj: l,
      tick: (t) => {
        const sec = t * (SPAN + 0.35);
        const heat = arc(sec);
        const gutter = 0.84 + 0.1 * Math.sin(sec * 31) + 0.06 * Math.sin(sec * 17.3 + 1.7)
          + 0.04 * Math.random();
        l.position.y = at.y + 0.3 + 0.55 * heat;
        l.intensity = (1.2 + 13 * heat) * gutter
          + 2.2 * Math.max(0, 1 - sec / (SPAN + 0.35)) ** 2;   // the coals, after
      },
    };
  });

  // The char: the card blackening under its own fire, and the last thing
  // left when the flames have gone.
  //
  // It is CARD sized and no bigger, and this is not a taste decision. Each
  // square is a recess in the flagstones and the rim round it stands higher
  // than the card face, so a decal laid at card height is clipped by the
  // stone the moment it runs past the card's edge — a wider scorch came out
  // as a blotch with four straight sides. Anything that has to spill onto the
  // stone has to be LIGHT, not geometry, which is what the point light above
  // is for.
  stage(kit, when + 0.08, 1.8, () => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 0.99, CARD_H * 0.99),
      new THREE.MeshBasicMaterial({
        map: scorchTex(), color: 0x0d0704, transparent: true, depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI;
    // +0.058 and not the +0.042 this started at: `at` is the card's own
    // height, and a decal much nearer than this to the face loses the depth
    // test against it and disappears — intermittently, which is worse, since
    // it survived every early shot and vanished in the late ones.
    m.position.copy(at).setY(at.y + 0.058);
    return {
      obj: m,
      tick: (t) => {
        const sec = t * 1.8;
        m.scale.setScalar(0.62 + easeOut(Math.min(1, sec * 2.2)) * 0.38);
        // it goes on blackening the whole time the fire is on it, and only
        // begins to fade once there is nothing left burning
        m.material.opacity = 0.94 * Math.min(1, sec / 0.34) ** 0.8
          * (sec < 1.3 ? 1 : Math.max(0, 1 - (sec - 1.3) / 0.45));
      },
    };
  });
}
