// THE ICE BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt } from '../cloth-kit.js';

/** The wrap freezes solid round them, then lets go in shards. */
export function freeze(kit, when, at, look) {
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
