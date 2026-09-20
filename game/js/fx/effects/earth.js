// THE EARTH BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt } from '../cloth-kit.js';

/** The wrap hauls them off their square: the ground heaves under them. */
export function heave(kit, when, at, dest, away, look) {
  const dir = dest ? dest.clone().sub(at).setY(0).normalize() : away.clone();

  // The courtyard bucks up UNDER them and tips toward where they are going.
  // A slab slid across at card height read as a plank being pushed through the
  // middle of the wrap; one big box rising read as a crate. Broken ground is
  // several stones at odds with each other, and it must not clear the card.
  stage(kit, when, 0.8, () => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6d5540, roughness: 1, transparent: true, flatShading: true,
    });
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(CARD_W * 1.0, 0.4, CARD_H * 0.9), mat);
    g.add(plate);
    for (let i = 0; i < 3; i++) {
      const sh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4 + Math.random() * 0.5, 0.3, 0.35 + Math.random() * 0.4), mat,
      );
      const a = Math.random() * Math.PI * 2;
      sh.position.set(Math.cos(a) * 0.95, -0.12 + Math.random() * 0.1, Math.sin(a) * 0.95);
      sh.rotation.set(Math.random() * 0.5, a, Math.random() * 0.5 - 0.25);
      g.add(sh);
    }
    const tip = new THREE.Vector3(-dir.z, 0, dir.x);   // tilt axis, across the push
    return {
      obj: g,
      tick: (t) => {
        const lift = Math.sin(Math.PI * Math.min(1, t * 1.25)) ** 0.8;
        g.position.copy(at).setY(-0.36 + lift * 0.26).addScaledVector(dir, lift * 0.28);
        g.quaternion.setFromAxisAngle(tip, lift * 0.4);
        mat.opacity = 1 - easeIn(t);
      },
    };
  });

  stage(kit, when, 0.9, () => {
    const grp = new THREE.Group();
    const vel = [];
    const stone = new THREE.MeshStandardMaterial({
      color: 0x7d6046, roughness: 1, flatShading: true,
    });
    for (let i = 0; i < 12; i++) {
      grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + Math.random() * 0.11, 0), stone));
      vel.push(dir.clone().multiplyScalar(1.2 + Math.random() * 2.2).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.2, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2,
      )));
    }
    return {
      obj: grp,
      tick: (t) => {
        for (let i = 0; i < grp.children.length; i++) {
          const r = grp.children[i];
          r.position.copy(at).setY(0.16).addScaledVector(vel[i], t);
          r.position.y -= t * t * 4.4;
          if (r.position.y < 0.1) r.position.y = 0.1;
          r.rotation.set(t * 7 + i, t * 5, t * 3);
        }
      },
    };
  });

  puff(kit, when, at, 'rgba(198,166,120,1)', {
    count: 26, spread: 1.3, rise: 1.0, seconds: 0.9, size: 0.7, drag: 1.1,
    bias: dir.clone().multiplyScalar(1.7),
  });
  ring(kit, when, at, 0xc9a06a, { size: 2.4, seconds: 0.55 });
  glowAt(kit, when, at.clone().setY(0.8), 0xd2a86e, { power: 12, seconds: 0.45 });
  if (dest) {
    // the shove has to arrive somewhere, a beat later
    ring(kit, when + 0.3, dest, 0xc9a06a, { size: 2.8, seconds: 0.5 });
    puff(kit, when + 0.3, dest, look.glow, { count: 16, spread: 1.3, rise: 1.0, seconds: 0.6, size: 0.45 });
    glowAt(kit, when + 0.3, dest.clone().setY(0.7), 0xd2a86e, { power: 9, seconds: 0.4 });
  }
}

/* ------------------------------------------------------------- lightning */

/** Forked arcs, rebuilt each time so no two look alike. */
