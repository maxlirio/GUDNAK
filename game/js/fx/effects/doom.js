// THE DOOM BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt } from '../cloth-kit.js';

/** It goes off where it stands: the wrap draws in, then lets go all at once. */
export function doom(kit, when, at, look) {
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
