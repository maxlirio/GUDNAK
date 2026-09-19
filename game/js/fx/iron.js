// IRON — what Refractory does to people. Chains, and the brand.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/iron.js --out /tmp/i.png --settle 400

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from './kit.js';

const IRON = 0x6b6258;

export function chains(kit, from, to) {
    const a = kit.at(from) || kit.at(to);
    const b = kit.at(to);
    if (!a || !b) return;
    const chain = chain(a, b);
    kit.hold(chain, 0.85, (t) => {
      // thrown, held, then gone
      const lay = t < 0.35 ? t / 0.35 : 1;
      chain.userData.lay(lay);
      const fade = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
      for (const link of chain.children) {
        link.material.opacity = fade;
        link.material.transparent = true;
        if (t > 0.35) link.position.y -= (t - 0.35) * 0.35;
      }
    });
    kit.ring(b, 0x8a7f70, { size: 1.5, seconds: 0.5 });
  }

export function brand(kit, target) {
    const at = kit.at(target);
    if (!at) return;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a0d07, emissive: 0xff5a2a, emissiveIntensity: 1.6,
      roughness: 1, side: THREE.DoubleSide, transparent: true,
    });
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 20), mat);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34, 4), mat);
      spike.position.set(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52);
      spike.rotation.z = -Math.PI / 2;
      spike.rotation.y = -a;
      g.add(spike);
    }
    g.position.copy(at);
    g.position.y += 0.12;
    kit.hold(g, 0.95, (t) => {
      const grow = t < 0.3 ? easeOut(t / 0.3) : 1;
      g.scale.setScalar(0.4 + grow * 0.8);
      g.rotation.y = (1 - grow) * 1.2;
      mat.emissiveIntensity = 1.9 - Math.max(0, t - 0.45) * 2.4;
      mat.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    });
    kit.sparks(at.clone().setY(at.y + 0.2),
      { colour: 'rgba(255,120,60,1)', count: 10, spread: 0.5, seconds: 0.5, rise: 0.7 });
  }
