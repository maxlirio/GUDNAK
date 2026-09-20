// THE SHADOW BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.
//
// The card reaches into the Void — a square that is a place of ABSENCE — so
// the ending is a subtraction, not an explosion: the light on the stone is
// drawn in, the flagstones open, and the bound figure is taken down through
// the gap. Everything here is either black or a thin cold edge on black, and
// the only fast beat in it is the drop.

import { THREE, CARD_W, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, glowAt } from '../cloth-kit.js';

// Not `look.colour`, on purpose. That is the colour of the CLOTH, and this is
// light caught on an edge: at the bolt's own violet the lip read as another
// piece of the bolt lying on the floor rather than as the far side of a hole.
const LIP = 0xc4a6ff;   // the cut edge: violet washed almost to white
const COLD = 0x7846c4;  // what little light the Void gives back

const R = CARD_W * 0.70;   // the mouth swallows the whole card, corners and all

// A hole torn in flagstones is not turned on a lathe. One radius function
// serves both the decal and the ring of light on its edge, so the paint and
// the geometry wobble together instead of showing a seam between them.
// Kept shallow: at ten per cent the wobble stopped reading as a tear in stone
// and started reading as an ink blot with lobes.
const edge = (a) => 1
  + 0.030 * Math.sin(a * 3 + 0.7)
  + 0.017 * Math.sin(a * 7 + 2.1)
  + 0.009 * Math.sin(a * 11 + 4.2);

/**
 * The mouth, as a texture rather than a ring of geometry.
 *
 * Drawn as flat-shaded geometry it read as a sticker: a circle of paint on the
 * stone. A hole is black to a hard lip and then bleeds shadow onto the
 * flagstones around it, so the falloff lives in the alpha channel — which also
 * keeps the edge smooth when it is scaled right down at the close, where a
 * segmented CircleGeometry showed its facets.
 *
 * The pale crescent is the inner wall on the far side — the only part of a
 * well you can see from above. Without it the hole is a cut-out with no
 * thickness, and thickness is the whole of "deep" at this camera. It is baked
 * toward -z, the far side for a seat-0 view; from the opposite seat it lands
 * on the near wall instead, which is wrong but at this size and blur reads
 * only as haze in the hole.
 */
let MOUTH = null;
function mouth() {
  if (MOUTH) return MOUTH;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  // canvas +x,+y run with world +x,+z here, so `edge` lines up with the ring
  const path = (rad) => {
    g.beginPath();
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const r = rad * edge(a);
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  };
  // Only a breath of soot outside the edge. Drawn with the heavy blur this
  // wanted, the black crept out over the ring of light and swallowed it: the
  // hole lost its lip and became a puddle. The wide shadow on the flagstones
  // is a separate decal for exactly that reason.
  g.filter = 'blur(9px)';
  g.fillStyle = 'rgba(4,1,10,0.4)';
  path(96); g.fill();
  g.filter = 'blur(2px)';                        // the lip: all but hard
  g.fillStyle = 'rgba(1,0,3,1)';
  path(89.6);                                    // 0.70 of the half-width
  g.fill();
  g.filter = 'blur(11px)';                       // the far wall, caught edge-on
  g.fillStyle = 'rgba(34,16,64,0.9)';
  g.beginPath();
  g.ellipse(128, 102, 70, 38, 0, Math.PI * 1.08, Math.PI * 1.92);
  g.fill();
  g.filter = 'none';
  MOUTH = new THREE.CanvasTexture(c);
  MOUTH.colorSpace = THREE.SRGBColorSpace;
  return MOUTH;
}

/**
 * A band lying flat on the stones, following the torn edge. `u` runs across
 * the band so a gradient can be laid along it: a ring of flat colour between
 * two hard radii is a painted hoop, and what this needs is a line of light
 * with a hot core and a falloff, which is what light on an edge looks like.
 */
function tornRing(inner, outer, segs = 128) {
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const uv = new Float32Array((segs + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const e = edge(a), c = Math.cos(a), s = Math.sin(a), k = i * 6;
    pos[k] = c * inner * e; pos[k + 2] = s * inner * e;
    pos[k + 3] = c * outer * e; pos[k + 5] = s * outer * e;
    uv[i * 4] = 0; uv[i * 4 + 1] = 0.5;
    uv[i * 4 + 2] = 1; uv[i * 4 + 3] = 0.5;
    if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** The cross-section of that line of light: a hot core just inside the lip. */
let BAND = null;
function band() {
  if (BAND) return BAND;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0.00, 'rgba(255,255,255,0.08)');
  grd.addColorStop(0.17, 'rgba(255,255,255,1)');
  grd.addColorStop(0.26, 'rgba(255,255,255,0.6)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 4);
  BAND = new THREE.CanvasTexture(c);
  BAND.colorSpace = THREE.SRGBColorSpace;
  return BAND;
}

/** A flat quad lying on the stones, so every decal here is built the same way. */
function decal(map, size, blending = THREE.NormalBlending) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map, transparent: true, depthWrite: false, blending, side: THREE.DoubleSide,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Dragged down into the dark: the stones open, they go through, it shuts. */
export function drag(kit, when, at, look) {
  /* ------------------------------------------- the light leaves the square */

  // Every other bolt throws a ring OUT. This one pulls one in, because that is
  // the whole reading: the square's own light is being taken. It arrives ahead
  // of the hole so the eye is already on the card when the stones give way.
  stage(kit, when, 0.36, () => {
    const m = new THREE.Mesh(
      tornRing(0.88, 1.06),
      new THREE.MeshBasicMaterial({
        map: band(), color: LIP, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    m.position.copy(at).setY(at.y + 0.07);
    return {
      obj: m,
      tick: (t) => {
        const k = easeIn(t);                     // slow to leave, then snatched
        m.scale.setScalar(2.6 - k * (2.6 - R));
        m.material.opacity = 0.18 + 0.7 * k * k;
      },
    };
  });

  // The stone around them goes cold, and stays cold for half a second after
  // the hole has gone: full brazier light returning the instant the stones
  // closed said nothing had happened here.
  //
  // A black disc with a soft alpha skirt does what a multiply pass would and
  // can still be faded out again, which MultiplyBlending cannot — its alpha is
  // ignored, so it can only ever be turned off, never turned down.
  stage(kit, when, 2.0, () => {
    const m = decal(blobTexture('rgba(3,1,8,0.9)', 'rgba(3,1,8,0)'), R * 4.6);
    // Every flat thing here is a good six centimetres over `at`. At two it
    // failed the depth test against the card itself and drew only on the stone
    // AROUND it, leaving the card lit and untouched in the middle of its own
    // shadow — the one place the darkness had to land.
    m.position.copy(at).setY(at.y + 0.06);
    return {
      obj: m,
      tick: (t) => {
        const k = easeOut(Math.min(1, t * 7));
        m.material.opacity = k * (1 - easeIn(Math.min(1, Math.max(0, (t - 0.55) / 0.45))));
        m.scale.setScalar(0.5 + k * 0.5);
      },
    };
  });

  /* --------------------------------------------------------------- the hole */

  stage(kit, when + 0.16, 1.25, () => {
    const g = new THREE.Group();
    const hole = decal(mouth(), R * 2.86);       // the texture's lip sits at 0.70
    hole.position.y = 0.075;

    // Something a long way down. The figure below is black and so is the hole,
    // so without this the drop is invisible: what reads is the dark shape
    // ECLIPSING the far light as it falls past it.
    const deepMat = new THREE.MeshBasicMaterial({
      map: blobTexture('rgba(128,86,204,0.9)', 'rgba(60,30,110,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const deep = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.9, R * 1.9), deepMat);
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(0, 0.078, -R * 0.12);      // set back, where the wall falls away

    // The lip, kept as its own thin ring so it can flare as the hole opens and
    // pinch as it shuts. Baked into the mouth texture it was dead light, and a
    // fat additive donut — what this used to be — reads as a lit pool, which is
    // the opposite of a hole.
    const lipMat = new THREE.MeshBasicMaterial({
      map: band(), color: LIP, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const lip = new THREE.Mesh(tornRing(R * 0.955, R * 1.115), lipMat);
    lip.position.y = 0.082;
    const haloMat = new THREE.MeshBasicMaterial({
      map: band(), color: COLD, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(tornRing(R * 1.02, R * 1.5), haloMat);
    halo.position.y = 0.072;
    // These four lie within a couple of centimetres of each other, so the
    // depth sort put them in whatever order the camera happened to give — and
    // with the black decal landing last it painted out both the light down the
    // hole and the ring round its edge. The stack is stated instead.
    hole.renderOrder = 1; deep.renderOrder = 2; halo.renderOrder = 3; lip.renderOrder = 4;
    g.add(hole, deep, lip, halo);
    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        // It tears open fast and shuts slowly: a hole that irises shut at the
        // same speed it opened read as a camera shutter, which is a mechanism,
        // and this is supposed to be a mouth.
        const open = easeOut(Math.min(1, t / 0.17));
        const shut = t > 0.72 ? 1 - easeIn(Math.min(1, (t - 0.72) / 0.28)) : 1;
        const s = Math.max(0.001, open * shut);
        g.scale.set(s, 1, s);
        hole.material.opacity = Math.min(1, open * 1.4);
        // brightest at the tear and again at the pinch, dim while it just sits
        // there being a hole. Unclamped, the first term went back through zero
        // and climbed again, so the lip blew out to white halfway through.
        const flare = Math.max(
          Math.max(0, 1 - t / 0.17) ** 2,
          t > 0.72 ? Math.min(1, (t - 0.72) / 0.28) ** 2 : 0,
        );
        lipMat.opacity = (0.62 + 0.38 * flare) * Math.min(1, open * 2);
        haloMat.opacity = 0.34 * flare * open;
        // The Void's own light, a long way down. It comes up only while they
        // are falling through it and is gone before the hole shuts, so it
        // reads as something glimpsed rather than as a lamp in the floor.
        deepMat.opacity = 0.3
          * Math.min(1, Math.max(0, (t - 0.20) / 0.10))
          * (1 - easeIn(Math.min(1, Math.max(0, (t - 0.50) / 0.14)))) * shut;
      },
    };
  });

  /* ----------------------------------------------------- and down they go */

  // Them, as a shape cut out of the light. The old version put pale tendrils up
  // out of the pool, which at this camera were rubber legs and made the square
  // the source of something rather than the end of someone. What has to be on
  // screen is the bound figure LEAVING, so it is a black cocoon the size of the
  // wrap, lit only along its rim, dropping as the cloth peels off it.
  stage(kit, when + 0.22, 1.2, () => {
    // A cocoon rather than a dome: shouldered, drawn in toward a small crown,
    // and closed off across the bottom so the silhouette is solid all the way
    // to the floor.
    const prof = [[0.0, 0.0], [0.99, 0.0], [1.0, 0.14], [0.96, 0.34], [0.86, 0.54],
      [0.70, 0.72], [0.46, 0.87], [0.22, 0.96], [0.0, 1.0]];
    const body = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), 26,
    );
    const bodyMat = new THREE.MeshBasicMaterial({
      color: 0x050210, transparent: true, side: THREE.DoubleSide,
    });
    // The rim is a larger copy of them drawn BEHIND the body and painted over
    // by it, so all that survives is the outline. The obvious way round — an
    // inverted hull of back faces drawn on top — needs a back face at the
    // silhouette, and a shape standing on the floor has none along its near,
    // ground-meeting half: the light came out as a crescent over their head
    // and nothing under it, a moon rather than a figure.
    const rimMat = new THREE.MeshBasicMaterial({
      color: LIP, transparent: true, depthWrite: false,
      side: THREE.FrontSide, blending: THREE.AdditiveBlending,
    });
    const g = new THREE.Group();
    const shell = new THREE.Mesh(body, bodyMat);
    const rim = new THREE.Mesh(body, rimMat);
    rim.scale.setScalar(1.12);
    rim.renderOrder = 5; shell.renderOrder = 6;
    g.add(shell, rim);
    g.position.copy(at).setY(at.y + 0.07);
    return {
      obj: g,
      tick: (t) => {
        // held while the cloth is still tight round them, then taken —
        // accelerating, the one fast thing in the whole ending
        const k = easeIn(Math.max(0, (t - 0.20) / 0.44));
        const w = 0.60 * (1 - k * 0.8);
        g.scale.set(w, 1.26 * (1 - k * 0.66), w);
        g.position.y = at.y + 0.07 - k * 0.72;
        g.rotation.y = t * 0.8;
        bodyMat.opacity = Math.min(1, t * 8) * (1 - easeIn(Math.min(1, k * 1.3)));
        rimMat.opacity = 0.5 * bodyMat.opacity;
      },
    };
  });

  /* --------------------------------------------- what is left of their light */

  // Motes of it, falling in. They spiral because a straight drop read as rain,
  // and they die AT the lip rather than in the middle, so the hole stays black
  // all the way across.
  stage(kit, when, 1.05, () => {
    const tex = blobTexture(look.glow, look.glow.replace(/,\s*1\)$/, ',0)'));
    const grp = new THREE.Group();
    const seed = [];
    for (let i = 0; i < 26; i++) {
      grp.add(new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })));
      const a = Math.random() * Math.PI * 2;
      seed.push({
        a, r: 0.5 + Math.random() * 1.5, h: 0.15 + Math.random() * 1.0,
        t0: Math.random() * 0.45, spin: 2.2 + Math.random() * 2.6,
        size: 0.14 + Math.random() * 0.16,
      });
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < grp.children.length; i++) {
          const s = grp.children[i], d = seed[i];
          const k = Math.min(1, Math.max(0, (t - d.t0) / (0.72 - d.t0 * 0.5)));
          const e = easeIn(k);
          const r = d.r * (1 - e) + R * 0.8 * e;
          s.position.set(
            at.x + Math.cos(d.a + e * d.spin) * r,
            at.y + 0.06 + d.h * (1 - e) ** 1.4,
            at.z + Math.sin(d.a + e * d.spin) * r,
          );
          s.scale.setScalar(d.size * (1 - k * 0.35));
          s.material.opacity = Math.min(1, k * 6) * (1 - k) ** 0.8;
        }
      },
    };
  });

  /* ------------------------------------------------------------ the bruise */

  // The square does not come straight back. As the stones closed, the card
  // beneath them came up again clean and lit, which read as the fighter
  // RETURNING — so a stain is laid over where they were, dark enough to keep
  // the card down until the game itself takes it away.
  stage(kit, when + 1.0, 1.1, () => {
    const g = new THREE.Group();
    const wide = decal(blobTexture('rgba(14,5,30,0.85)', 'rgba(14,5,30,0)'), R * 3.2);
    wide.position.y = 0.062;
    const core = decal(blobTexture('rgba(3,1,8,0.95)', 'rgba(3,1,8,0)'), R * 1.7);
    core.position.y = 0.068;
    g.add(wide, core);
    g.position.copy(at);
    return {
      obj: g,
      tick: (t) => {
        const fade = Math.min(1, t * 4) * (1 - easeIn(Math.min(1, t / 0.9)));
        wide.material.opacity = fade;
        core.material.opacity = fade * 0.9;
        g.scale.setScalar(0.72 + t * 0.4);
      },
    };
  });

  // One cold breath of light at the tear, and nothing after it. A lasting glow
  // would be the Void giving something back, which it does not do.
  glowAt(kit, when, at.clone().setY(at.y + 0.45), COLD, { power: 11, seconds: 0.4 });
}

/* ------------------------------------------------------------------ doom */

/** It goes off where it stands: the wrap draws in, then lets go all at once. */
