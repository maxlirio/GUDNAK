// THE LIGHTNING BOLT — what the cloth does once it has hold of them.
//
// The unrolling and the winding are shared (../cloth-kit.js); this file owns
// only the ending, and the colours it asks the cloth to take on as it grips.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { stage, ring, puff, glowAt, arcs } from '../cloth-kit.js';

/** Your own fighter is crackled out of one square and into another. */
export function blink(kit, when, at, dest, look) {
  const to = dest || at;
  arcs(kit, when, at, { count: 9, reach: 0.19 });
  ring(kit, when, at, look.colour, { size: 2.0, seconds: 0.4 });
  puff(kit, when, at, look.glow, { count: 12, spread: 0.7, rise: 1.8, seconds: 0.45, size: 0.3, drag: 0.6 });
  glowAt(kit, when, at.clone().setY(at.y + 0.7), look.colour, { power: 26, seconds: 0.3, reach: 6 });

  // the fighter as a bolt of light between the squares: a card-sized plate
  // stretched out of one and snapped shut on the other
  stage(kit, when + 0.04, 0.4, () => {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({
        color: 0xfff4b0, transparent: true, opacity: 0.6, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    g.rotation.x = -Math.PI / 2;
    return {
      obj: g,
      tick: (t) => {
        const k = easeInOut(Math.min(1, t / 0.85));
        g.position.copy(at).lerp(to, k);
        g.position.y = at.y + 0.12 + Math.sin(Math.PI * k) * 0.6;
        // squeezed thin in flight, because a thing that streaks is not a card
        const thin = 1 - Math.sin(Math.PI * k) * 0.82;
        g.scale.set(1 + Math.sin(Math.PI * k) * 0.55, thin, 1);
        g.material.opacity = 0.6 * (1 - Math.max(0, t - 0.7) / 0.3);
      },
    };
  });

  if (dest) {
    arcs(kit, when + 0.32, dest, { count: 10, reach: 0.21, seconds: 0.45 });
    ring(kit, when + 0.32, dest, look.colour, { size: 2.6, seconds: 0.5 });
    puff(kit, when + 0.32, dest, look.glow, { count: 14, spread: 0.8, rise: 1.6, seconds: 0.5, size: 0.32, drag: 0.6 });
    glowAt(kit, when + 0.32, dest.clone().setY(dest.y + 0.7), look.colour,
      { power: 26, seconds: 0.35, reach: 6 });
  }
}

/* ---------------------------------------------------------------- shadow */

/** Dragged down into the dark: a pool opens, tendrils take them, it shuts. */
