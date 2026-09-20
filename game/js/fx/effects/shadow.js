// THE SHADOW BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, glowAt } from '../cloth-kit.js';

/** Dragged down into the dark: a pool opens, tendrils take them, it shuts. */
export function drag(kit, when, at, look) {
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
