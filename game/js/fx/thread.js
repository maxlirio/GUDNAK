// THREAD — the Weavers stitch rather than throw.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/thread.js --out /tmp/t.png --settle 400

import { THREE, easeInOut } from './kit.js';

export function threads(kit, at, colour = 0xffc46a) {
    const from = kit.at(at);
    if (!from) return;
    const mat = new THREE.MeshBasicMaterial({
      color: colour, transparent: true, blending: THREE.AdditiveBlending,
    });
    const g = new THREE.Group();
    const ends = [];
    for (let i = 0; i < 8; i++) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1), mat);
      g.add(ribbon);
      const a = (i / 8) * Math.PI * 2;
      ends.push(new THREE.Vector3(Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.2));
    }
    g.position.copy(from);
    kit.hold(g, 0.9, (t) => {
      const e = easeInOut(Math.min(1, t * 1.6));
      for (let i = 0; i < g.children.length; i++) {
        const r = g.children[i];
        const end = ends[i].clone().multiplyScalar(e);
        r.position.copy(end).multiplyScalar(0.5);
        r.scale.z = end.length();
        r.lookAt(g.position.clone().add(end));
        r.rotation.z = t * 3;
      }
      mat.opacity = t < 0.55 ? 0.9 : 0.9 * (1 - (t - 0.55) / 0.45);
    });
  }
