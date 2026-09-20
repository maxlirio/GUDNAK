// THE DOOM BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.
//
// This is the one bolt that wraps its OWN carrier: it is a suicide bomb, and
// it kills every neighbour that shares a trait with it. So the ending runs in
// three beats — the wrap CINCHES and light builds along its seams; it BURSTS,
// throwing the bandage off in rags; and a hard shock runs out flat across the
// stone, far enough to cross all four squares around it. The reach is written
// in SQUARES (arena's STEP) rather than guessed in world units, because "as
// far as the neighbours" is the whole point of the card.
//
// The first pass was a white ball on top of the wrap and two thin rings. It
// read as a small pop on one card: nothing ever left the carrier's square, so
// the effect that kills several fighters at once was the quietest of the six.
// The size here is carried by SHAPES — two off-round fronts crossing the
// neighbours, blast lobes down the four directions that matter, and the bolt's
// own cloth landing in rags on their squares — not by brightness. The lights
// are deliberately short and their reach is kept under two squares: an earlier
// effect elsewhere lit the whole board pink and had to be pulled back, and a
// blast that washes out the battlefield hides the very shapes that make it
// read as big.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { STEP } from '../../arena.js';
import { stage, puff, glowAt, weave } from '../cloth-kit.js';

/* ------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold() disposes materials and a
// material never disposes its map, so the second Doom Bolt of a game must not
// redraw these canvases.
const TEXES = new Map();
function tex(key, paint, size = 256) {
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

// One stream, so the crack pattern and the scorch under it are the same every
// time the card is played and can be judged from a screenshot.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/**
 * The shock front, drawn once and then simply scaled up.
 *
 * A RingGeometry gives a mathematically round hoop with a flat edge, and at
 * this camera that is a UI element sliding across the table. Baking the front
 * into a texture buys the two things a ring cannot have: a profile (almost
 * nothing behind it, a hard bright rim, and a clean cut at the very front) and
 * an outline that is OFF-round, which is what stops the eye reading it as a
 * drawn circle.
 */
const shockTex = () => tex('doom-shock', (g, s) => {
  const c = s / 2;
  // The COLOUR is baked in, not tinted on: the front has to be near-white at
  // the rim and deep red behind it, and a single tint cannot be both. The
  // first cut left the whole disc pale and additive, and 3.5 units of 14%
  // white over the table came out as a soap bubble sitting on the board —
  // everything inside 0.85 is now flatly transparent so only the FRONT shows.
  const grd = g.createRadialGradient(c, c, 0, c, c, c);
  grd.addColorStop(0.00, 'rgba(150,14,30,0)');
  grd.addColorStop(0.82, 'rgba(150,14,30,0)');
  grd.addColorStop(0.885, 'rgba(198,26,48,0.22)');
  grd.addColorStop(0.938, 'rgba(255,74,96,0.66)');
  grd.addColorStop(0.968, 'rgba(255,196,205,1)');
  grd.addColorStop(0.988, 'rgba(255,120,140,0.32)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.save();
  g.beginPath();
  for (let i = 0; i <= 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const r = c * (0.91 + 0.072 * Math.sin(a * 3 + 0.7) + 0.045 * Math.sin(a * 7 + 2.3));
    const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.clip();
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  // Streaks dragged back from the front, kept inside the front's own depth so
  // they break its edge up without filling the middle in again.
  const rnd = rng(90210);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, w = 0.003 + rnd() * 0.01;
    const r0 = c * (0.84 + rnd() * 0.06), r1 = c * (0.94 + rnd() * 0.05);
    g.beginPath();
    g.moveTo(c + Math.cos(a - w) * r0, c + Math.sin(a - w) * r0);
    g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    g.lineTo(c + Math.cos(a + w) * r0, c + Math.sin(a + w) * r0);
    g.closePath();
    g.fillStyle = `rgba(255,150,165,${0.1 + rnd() * 0.22})`;
    g.fill();
  }
  g.restore();
}, 512);

/** Dust: lobed and holed, so a wall of it has an outline instead of an edge. */
const dustTex = () => tex('doom-dust', (g, s) => {
  const rnd = rng(5150);
  const lobe = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.5, `rgba(255,255,255,${a * 0.5})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  lobe(64, 64, 44, 0.55);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, d = 10 + rnd() * 24;
    lobe(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 15 + rnd() * 19, 0.2 + rnd() * 0.24);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, d = 22 + rnd() * 34;
    lobe(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 12 + rnd() * 16, 0.6 + rnd() * 0.4);
  }
}, 128);

/** A blast lobe: wide at the crater, drawn out to a point down one direction. */
const lobeTex = () => tex('doom-lobe', (g, s) => {
  const rnd = rng(4242);
  // The lobe points along +x. The gradient is along its length so it is welded
  // to the crater at one end and gone at the other; a lobe with a hard tail
  // reads as a painted arrow.
  const grd = g.createLinearGradient(0, 0, s, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  grd.addColorStop(0.86, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  for (let i = 0; i < 26; i++) {
    // built out of overlapping tapered slivers, so its edges are ragged
    const y = s / 2 + (rnd() - 0.5) * s * 0.34;
    const half = s * (0.1 + rnd() * 0.13) * (1 - i / 40);
    g.beginPath();
    g.moveTo(0, y - half * 0.4);
    g.quadraticCurveTo(s * 0.4, y - half, s * (0.7 + rnd() * 0.3), y);
    g.quadraticCurveTo(s * 0.4, y + half, 0, y + half * 0.4);
    g.closePath();
    g.globalAlpha = 0.16 + rnd() * 0.2;
    g.fill();
  }
});

/**
 * Fractures, forked and tapering, running out from under the carrier.
 *
 * Painted twice from the same seed so the hot copy and the cold one are the
 * SAME crack. `pen` sets the stroke before every stroke, which is what lets
 * the cold pass lay a pale lip down first and the dark split over it: a crack
 * drawn only in near-black was invisible on this board, because the stone it
 * is splitting is already dark. What reads is the fresh pale rock at the lip.
 */
function paintCracks(g, s, pen, ox = 0, oy = 0) {
  const c = s / 2, rnd = rng(31337);
  g.lineCap = 'round';
  const limb = (x, y, a, len, w, depth) => {
    let px = x, py = y;
    for (let i = 0; i < 8; i++) {
      const l = len / 8;
      a += (rnd() - 0.5) * 0.55;
      const nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l;
      pen(Math.max(0.35, w * (1 - i / 8) ** 1.5));
      g.beginPath(); g.moveTo(px + ox, py + oy); g.lineTo(nx + ox, ny + oy); g.stroke();
      px = nx; py = ny;
      // A crack that does not fork is a scratch. Forks are shorter and thinner
      // than their parent, which is what makes the pattern read as splitting
      // stone rather than as a drawn asterisk — the first pass was eight even
      // spokes and looked exactly like one.
      if (depth > 0 && rnd() < 0.5) {
        limb(px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.6),
          len * (0.3 + rnd() * 0.25), w * 0.55, depth - 1);
      }
    }
  };
  // Seven mains, not twelve: even spokes of even length are a spider's web,
  // and that is what the board looked like. Stone splits into a few long runs
  // with short ones between them.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.7;
    const r0 = c * (0.04 + rnd() * 0.1);
    limb(c + Math.cos(a) * r0, c + Math.sin(a) * r0, a, c * (0.3 + rnd() * 0.58), 6, 3);
  }
}

/** The split in the stone: pale broken lip, dark gap. Lasts. */
const crackTex = () => tex('doom-crack', (g, s) => {
  // The GAP is the crack and the lip is a highlight beside it, not the other
  // way round. Drawn with a wide pale stroke and a thin dark one over it this
  // came out as a white web lying on the squares — cracked glass, not stone.
  // So the dark pass is the wide one, and the lip is thin and OFFSET, the way
  // fresh rock only shows along the side that broke upward.
  paintCracks(g, s, (w) => {
    g.strokeStyle = 'rgba(8,3,4,0.94)'; g.lineWidth = w * 1.6;
  });
  paintCracks(g, s, (w) => {
    g.strokeStyle = 'rgba(208,192,162,0.5)'; g.lineWidth = w * 0.85;
  }, 13, 11);
}, 512);

/** The same split while it is still glowing, laid over the cold one. */
const crackHotTex = () => tex('doom-crack-hot', (g, s) => {
  paintCracks(g, s, (w) => {
    g.strokeStyle = 'rgba(255,120,88,0.9)'; g.lineWidth = w * 0.7;
  });
}, 512);

/** What is left on the stone: a burnt blotch with a torn edge, never a disc. */
const scorchTex = () => tex('doom-scorch', (g, s) => {
  const c = s / 2, rnd = rng(8080);
  const grd = g.createRadialGradient(c, c, 0, c, c, c);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.78, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + rnd() * 0.3, r = c * (0.62 + rnd() * 0.36);
    g.beginPath();
    g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, c * (0.06 + rnd() * 0.15), 0, Math.PI * 2);
    g.fill();
  }
});

/* --------------------------------------------------------------- pieces */

/** A quad lying on the stone, scaled from its centre. Everything flat is one. */
function flat(map, colour, { additive = true, opacity = 1 } = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map, color: colour, transparent: true, depthWrite: false, opacity,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/* ------------------------------------------------------------ the ending */

/** It goes off where it stands: the wrap cinches, bursts, and the shock runs. */
export function doom(kit, when, at, look) {
  const GO = when + 0.30;          // the fuse: how long the cinch has to build
  // Clear of the card faces by a real margin. At +0.03 the ground decals lose
  // the depth test against the card they are drawn on and appear only on the
  // stone AROUND it — which is exactly where the crater must NOT be.
  const deck = at.y + 0.055;
  const REACH = STEP * 1.32;       // the shock crosses every neighbouring square

  /* ---------------------------------------------------------- 1. the fuse */

  // A ring running IN. It is what makes the burst land: without something
  // gathering first, the blast is just a thing that appears.
  stage(kit, when, 0.30, () => {
    const m = flat(shockTex(), 0xff8296);
    m.position.copy(at).setY(deck + 0.02);
    return {
      obj: m,
      tick: (t) => {
        const r = 2.5 * (1 - easeIn(t)) + 0.35;
        m.scale.set(r, r, 1);
        m.material.opacity = 0.25 + 0.6 * t;
      },
    };
  });

  // Light coming apart along the turns of cloth. The wrap is a dome — cloth-kit
  // lays its helix at R * sqrt(1 - w^2) and rises 0.9 over it — so the seams
  // have to be horizontal bands that follow that taper, and a band that does
  // not is a hoop floating through them.
  stage(kit, when, 0.34, () => {
    const R = Math.min(CARD_W, CARD_H) * 0.52;
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd2d8, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 5; i++) {
      const w = 0.12 + i * 0.17;
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(R * Math.sqrt(Math.max(0.05, 1 - w * w * 0.92)), 0.016, 6, 34),
        mat,
      );
      band.rotation.x = -Math.PI / 2;
      band.position.y = 0.9 * w - 0.02;
      grp.add(band);
    }
    grp.position.copy(at);
    return {
      obj: grp,
      tick: (t) => {
        // dark until the last third, then the seams open all at once
        mat.opacity = t < 0.55 ? t * 0.35 : 0.19 + easeIn((t - 0.55) / 0.45) * 0.95;
        const s = 1 + Math.max(0, t - 0.86) * 2.4;
        grp.scale.set(s, 1, s);
      },
    };
  });

  // The fuse light SWELLS, and glowAt only ever decays — so this one is its
  // own. Kept small and low: it is a glow inside the bundle, not a flare.
  stage(kit, when, 0.30, () => {
    const l = new THREE.PointLight(0xff3348, 0, 4.0, 2);
    l.position.copy(at).setY(at.y + 0.42);
    return { obj: l, tick: (t) => { l.intensity = 11 * easeIn(t); } };
  });

  /* ------------------------------------------------------- 2. the burst */

  // The bundle itself going. The cloth is not ours to change and it spends the
  // blast reeling calmly back onto its rod, which fought the whole beat — so
  // this is a shell cut to the wrap's own size and shape that whites it out on
  // the frame it goes off and then blows past it. What you see is the bandage
  // consumed, not a ball of light parked on top of a tidy cocoon.
  stage(kit, GO, 0.15, () => {
    const R = Math.min(CARD_W, CARD_H) * 0.54;
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshBasicMaterial({
        color: 0xffa3b3, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    m.position.copy(at).setY(at.y - 0.04);
    return {
      obj: m,
      tick: (t) => {
        // out fast and gone fast: held any longer it stops being the wrap
        // coming apart and becomes a soap bubble standing on the square
        const k = 1 + easeOut(t) * 1.15;
        m.scale.set(R * k, (0.94 + easeOut(t) * 0.45) * k * 0.8, R * k);
        m.material.opacity = (1 - t) ** 2.2;
      },
    };
  });

  // The core, squashed: a blast on a table spreads sideways. Short, because
  // the size of this bolt is carried by what runs out across the stone.
  stage(kit, GO, 0.14, () => {
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffe2e6, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    f.position.copy(at).setY(at.y + 0.3);
    return {
      obj: f,
      tick: (t) => {
        const s = 0.55 + easeOut(t) * 2.1;
        f.scale.set(s, s * 0.7, s);
        f.material.opacity = (1 - t) ** 1.6;
      },
    };
  });

  // Three frames of white on the stone under it. A blast has no ramp at its
  // start: without something that is simply ON for an instant, the burst reads
  // as a swell, and a swell is what the first pass looked like.
  stage(kit, GO, 0.075, () => {
    const m = flat(shockTex(), 0xffc2cc);
    m.position.copy(at).setY(deck + 0.055);
    return {
      obj: m,
      tick: (t) => {
        const r = 0.85 + t * 1.2;
        m.scale.set(r, r, 1);
        m.material.opacity = (1 - t) ** 0.6;
      },
    };
  });

  // Four lobes down the four neighbour directions. The board's squares step
  // along x and z, so these are not decoration — they are the force going at
  // the fighters this card kills, and they are what makes the blast read as
  // aimed outward rather than as a puddle of light on one square.
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.72, 0.72], [-0.72, 0.72],
    [0.72, -0.72], [-0.72, -0.72]];
  DIRS.forEach(([dx, dz], i) => {
    const axis = i < 4;
    stage(kit, GO, axis ? 0.26 : 0.2, () => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: lobeTex(), color: axis ? 0xff4d68 : 0xa81c30, transparent: true,
          depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        }),
      );
      // the quad's own +x runs down the lobe, so it is rotated into the
      // direction and then laid flat
      m.geometry.translate(0.5, 0, 0);
      m.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx));
      m.position.copy(at).setY(deck + 0.015);
      const len = (axis ? STEP * 1.3 : STEP * 0.8);
      return {
        obj: m,
        tick: (t) => {
          const k = easeOut(Math.min(1, t * 1.9));
          m.scale.set(len * k, 0.5 + k * 0.32, 1);
          m.material.opacity = (1 - t) ** 1.5;
        },
      };
    });
  });

  // The shock itself, flat on the stone and OFF-round, out past the far edge
  // of every neighbouring square and gone in a third of a second.
  stage(kit, GO, 0.36, () => {
    const m = flat(shockTex(), 0xffc3cc);
    m.position.copy(at).setY(deck + 0.05);
    return {
      obj: m,
      tick: (t) => {
        const r = 0.5 + easeOut(t) * REACH;
        m.scale.set(r, r, 1);
        m.material.opacity = Math.min(1, t * 9) * (1 - t) ** 0.8;
      },
    };
  });

  // A second, slower front behind it — deeper in colour and rolling out after
  // the first. One ring on its own reads as a pulse; two read as pressure.
  stage(kit, GO + 0.05, 0.5, () => {
    const m = flat(shockTex(), 0xc02338);
    // turned off the first front's lumps, or the two share one outline and
    // the pair reads as one thick ring rather than as two fronts
    m.rotation.z = 1.1;
    m.position.copy(at).setY(deck + 0.035);
    return {
      obj: m,
      tick: (t) => {
        const r = 0.3 + easeOut(t) * REACH * 0.82;
        m.scale.set(r, r, 1);
        m.material.opacity = Math.min(1, t * 6) * (1 - t) ** 1.3 * 0.75;
      },
    };
  });

  // Dust riding the front. A flat quad on its own is a picture of a shock
  // however well it is drawn — it has no near side and nothing to catch the
  // light. A low wall of grains travelling with it gives the front a body,
  // and because the pale grains brighten the stone and the dark ones hide it,
  // it also puts an edge on the wash instead of a fade.
  stage(kit, GO, 0.8, () => {
    const tx = dustTex();
    const grp = new THREE.Group();
    const seed = [];
    const TONE = [0xe8c3c8, 0xd39aa3, 0x8c4450, 0x5a2630, 0x40202a];
    for (let i = 0; i < 26; i++) {
      grp.add(new THREE.Sprite(new THREE.SpriteMaterial({
        map: tx, color: TONE[(Math.random() * TONE.length) | 0],
        transparent: true, depthWrite: false, opacity: 0,
      })));
      seed.push({
        a: (i / 26) * Math.PI * 2 + Math.random() * 0.3,
        f: 0.82 + Math.random() * 0.22,       // some grains outrun the front
        rise: 0.1 + Math.random() * 0.45,
        size: 0.4 + Math.random() * 0.42,
        t0: Math.random() * 0.12,
      });
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < seed.length; i++) {
          const d = seed[i], s = grp.children[i];
          const k = Math.max(0, (t - d.t0) / (1 - d.t0));
          const r = easeOut(Math.min(1, k * 1.7)) * REACH * d.f;
          s.position.set(at.x + Math.cos(d.a) * r, at.y + 0.06 + d.rise * k,
            at.z + Math.sin(d.a) * r);
          s.scale.setScalar(d.size * (0.5 + k * 1.5));
          s.material.opacity = Math.min(1, k * 7) * (1 - k) ** 1.5 * 0.7;
        }
      },
    };
  });

  /* -------------------------------------------------- 3. what it throws */

  // The bandage comes off in RAGS. This is the beat that ties the ending back
  // to the bolt: it is cloth that went off, so what is thrown is cloth — real
  // weave, lit like the bolt, tumbling and landing on the flagstones.
  stage(kit, GO, 1.15, () => {
    const w = weave();
    const burnt = new THREE.Color(look.colour).multiplyScalar(0.72);
    const mat = new THREE.MeshStandardMaterial({
      color: burnt, emissive: burnt, emissiveIntensity: 0.5,
      map: w.map, emissiveMap: w.map, alphaMap: w.alpha,
      alphaTest: 0.32, transparent: true, roughness: 0.95, metalness: 0,
      side: THREE.DoubleSide,
    });
    const grp = new THREE.Group();
    const rag = [];
    for (let i = 0; i < 22; i++) {
      // Long and narrow. Stubby quads tumbling at this size read as chips of
      // painted board; a torn strip has to be several times longer than it is
      // wide before the eye calls it cloth.
      const long = 0.34 + Math.random() * 0.5;
      const geo = new THREE.PlaneGeometry(long, 0.085 + Math.random() * 0.055, 3, 1);
      // The weave is a 256x96 canvas with a rib every 16px, so a whole tile
      // across a 30cm rag is a fine stripe pattern rather than cloth. A sixth
      // of a tile puts two or three ribs on each one, which is what a torn
      // strip of this bolt would actually show.
      const uv = geo.attributes.uv.array;
      for (let k = 0; k < uv.length; k += 2) uv[k] = uv[k] * 0.16;
      const m = new THREE.Mesh(geo, mat);
      grp.add(m);
      const a = Math.random() * Math.PI * 2;
      // Fast and far: the first cut threw them at 1.6-5 with heavy drag and
      // every rag landed inside the carrier's own square, which read as the
      // wrap falling off rather than being blown off. They have to clear the
      // card and end up ON the neighbours' stone.
      const out = 3.4 + Math.random() * 5.2;
      rag.push({
        p: at.clone().setY(at.y + 0.15 + Math.random() * 0.75),
        v: new THREE.Vector3(Math.cos(a) * out, 1.4 + Math.random() * 2.6, Math.sin(a) * out),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .multiplyScalar(13),
        rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3),
      });
    }
    const floor = at.y + 0.01;
    let prev = 0;
    return {
      obj: grp,
      tick: (t) => {
        const dt = Math.min(0.05, Math.max(0.001, (t - prev) * 1.15));
        prev = t;
        for (let i = 0; i < rag.length; i++) {
          const r = rag[i], m = grp.children[i];
          r.v.y -= 9.5 * dt;
          // Cloth is light: it is stopped by the air, and once it is down it
          // STAYS down. Rags left flying a parabola to the end of the tween
          // look like thrown stones.
          const drag = Math.exp(-1.35 * dt);
          r.v.x *= drag; r.v.z *= drag;
          r.p.addScaledVector(r.v, dt);
          if (r.p.y <= floor) {
            r.p.y = floor;
            r.v.set(0, 0, 0);
            r.rot.x += (-Math.PI / 2 - r.rot.x) * 0.25;   // settles flat
            r.rot.z *= 0.75;
          } else {
            r.rot.x += r.spin.x * dt; r.rot.y += r.spin.y * dt; r.rot.z += r.spin.z * dt;
          }
          m.position.copy(r.p);
          m.rotation.copy(r.rot);
        }
        mat.opacity = t < 0.68 ? 1 : 1 - (t - 0.68) / 0.32;
        mat.emissiveIntensity = 0.5 * (1 - t) + 0.08;
      },
    };
  });

  // Embers thrown low and long, out over the neighbours' squares. Through
  // puff(), not kit.sparks(): sparks start the moment they are built, and
  // everything in this file is built while the bolt is still on its rod — so
  // kit.sparks() threw the blast's embers across the table a second and a half
  // before the blast, during the throw.
  puff(kit, GO, at, 'rgba(255,170,178,1)', {
    count: 26, spread: 4.4, rise: 1.0, seconds: 0.75, size: 0.22, drag: 2.4, y: 0.16,
  });
  // and the smoke going straight up off the crater
  puff(kit, GO + 0.04, at, 'rgba(210,90,105,1)', {
    count: 20, spread: 0.85, rise: 2.2, seconds: 0.95, size: 0.5, drag: 1.0, y: 0.05,
  });

  /* ------------------------------------------------------ 4. what is left */

  // The fractures. They are drawn as one texture and scaled up from nothing,
  // so they RUN outward from under the carrier in the first two frames instead
  // of appearing whole; the hot copy is the stone still glowing in the split,
  // and it cools off the dark one underneath.
  // Stone, not card: at STEP the fractures ran clean across the neighbours'
  // card faces, and a crack over a card lying on top of it is nonsense. This
  // keeps them inside the ring of bare flagstone around the carrier.
  const crackScale = STEP * 0.72;
  stage(kit, GO, 0.55, () => {
    const m = flat(crackHotTex(), 0xffffff);
    m.position.copy(at).setY(deck + 0.012);
    return {
      obj: m,
      tick: (t) => {
        const k = easeOut(Math.min(1, t * 9));
        m.scale.set(crackScale * k, crackScale * k, 1);
        m.material.opacity = (1 - t) ** 1.4;
      },
    };
  });
  stage(kit, GO, 2.1, () => {
    const m = flat(crackTex(), 0xffffff, { additive: false });
    m.position.copy(at).setY(deck + 0.008);
    return {
      obj: m,
      tick: (t) => {
        const k = easeOut(Math.min(1, t * 24));
        m.scale.set(crackScale * k, crackScale * k, 1);
        m.material.opacity = 0.85 * (1 - Math.max(0, t - 0.35) / 0.65);
      },
    };
  });

  // The burn where the carrier stood. The rules take the card away a beat
  // later, and this is what the square is left holding.
  stage(kit, GO, 2.1, () => {
    const m = flat(scorchTex(), 0x0d0406, { additive: false });
    const r = CARD_W * 0.78;
    m.position.copy(at).setY(deck + 0.004);
    return {
      obj: m,
      tick: (t) => {
        const k = 0.6 + easeOut(Math.min(1, t * 8)) * 0.4;
        m.scale.set(r * k, r * k, 1);
        m.material.opacity = 0.7 * (1 - Math.max(0, t - 0.6) / 0.4);
      },
    };
  });

  /* ------------------------------------------------------------- 5. light */

  // Hard, brief, and no further than two squares. Reach is what floods a
  // board; power alone stays where it is put.
  glowAt(kit, GO, at.clone().setY(at.y + 0.5), 0xff5f70, { power: 34, seconds: 0.26, reach: 6.4 });
  glowAt(kit, GO + 0.05, at.clone().setY(at.y + 0.2), 0xff2c3e,
    { power: 9, seconds: 1.0, reach: 4.6, flicker: 0.3 });
}
