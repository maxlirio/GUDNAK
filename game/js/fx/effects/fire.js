// THE FIRE BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt } from '../cloth-kit.js';

/** They burn up inside the cloth: tongues of flame over the card's footprint. */
export function burn(kit, when, at, look) {
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
