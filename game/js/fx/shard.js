// SHARDSWORN — the Dragon's fire, and crystal.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/shard.js --out /tmp/s.png --settle 350

import { THREE, easeOut, easeIn } from './kit.js';

export function shardfire(kit, at) {
    const p = kit.at(at);
    if (!p) return;
    const PINK = 0xf03a72;

    const mat = new THREE.MeshStandardMaterial({
      color: PINK, emissive: 0xff5c8f, emissiveIntensity: 1.7,
      transparent: true, roughness: 0.2, flatShading: true,
    });
    const g = new THREE.Group();
    const dir = [];
    for (let i = 0; i < 14; i++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.44, 4), mat);
      g.add(shard);
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const lean = 0.55 + Math.random() * 0.9;
      dir.push(new THREE.Vector3(Math.cos(a) * 1.25, lean, Math.sin(a) * 1.05));
    }
    g.position.copy(p);
    kit.hold(g, 0.75, (t) => {
      const e = easeOut(t);
      for (let i = 0; i < g.children.length; i++) {
        const c = g.children[i];
        c.position.copy(dir[i]).multiplyScalar(e * 1.5);
        c.position.y -= t * t * 0.7;
        c.lookAt(g.position.clone().add(dir[i]).multiplyScalar(4));
        c.scale.setScalar(1 + e * 0.5);
      }
      mat.opacity = 1 - easeIn(t);
      mat.emissiveIntensity = 1.7 * (1 - t * 0.6);
    });

    kit.sparks(p, { colour: 'rgba(255,90,140,1)', count: 22, spread: 1.15, seconds: 0.7, rise: 1.5 });
    kit.ring(p, PINK, { size: 2.8, seconds: 0.6 });

    // a hard pink light, thrown from where it died
    // Lay Waste can kill half a dozen fighters in one go, and six of these
    // going off together turned the whole battlefield pink. Kept local.
    const light = new THREE.PointLight(0xff5c8f, 0, 6.5, 2);
    light.position.copy(p).setY(1.0);
    kit.hold(light, 0.4, (t) => {
      light.intensity = 14 * (1 - t) * (t < 0.2 ? t / 0.2 : 1);
    });
  }
