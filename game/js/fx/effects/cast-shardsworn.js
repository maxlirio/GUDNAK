// THE SHARDSWORN FLOURISH — crystal — pink, coming apart in facets.
//
// What a Shardsworn card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// One effect, one file. This is a plain starting point, not a finished thing.

import { THREE, FACTION, easeOut, easeIn, easeInOut } from '../kit.js';

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION['Shardsworn'] || FACTION.Neutral;

  const mat = new THREE.MeshStandardMaterial({
    color: look.spark, emissive: look.spark, emissiveIntensity: 1.1,
    transparent: true, roughness: 0.25, flatShading: true,
  });
  const g = new THREE.Group();
  const dir = [];
  for (let i = 0; i < 9; i++) {
    g.add(new THREE.Mesh(new THREE.TetrahedronGeometry(0.17), mat));
    const a = (i / 9) * Math.PI * 2;
    dir.push(new THREE.Vector3(Math.cos(a), 0.7 + Math.random(), Math.sin(a) * 0.8));
  }
  g.position.copy(p);
  kit.hold(g, 0.7, (t) => {
    for (let i = 0; i < g.children.length; i++) {
      g.children[i].position.copy(dir[i]).multiplyScalar(t * 1.3);
      g.children[i].rotation.set(t * 5, t * 4, 0);
    }
    mat.opacity = 1 - t;
  });
}
