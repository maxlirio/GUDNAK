// THE REFRACTORY FLOURISH — inquisitors — gold and white, a shaft of judgement from above.
//
// What a Refractory card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// One effect, one file. This is a plain starting point, not a finished thing.

import { THREE, FACTION, easeOut, easeIn, easeInOut } from '../kit.js';

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION['Refractory'] || FACTION.Neutral;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.62, 4.2, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: look.spark, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beam.position.copy(p).setY(2.2);
  kit.hold(beam, 0.6, (t) => {
    beam.scale.set(1 - t * 0.4, 1, 1 - t * 0.4);
    beam.material.opacity = 0.5 * (1 - t);
  });
  kit.sparks(p, { colour: look.glow, count: 10, spread: 0.5, seconds: 0.5, rise: 1.6 });
}
