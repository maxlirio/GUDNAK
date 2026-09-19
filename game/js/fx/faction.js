// The per-faction flourish every other card gets, plus the volley and the
// Weavers' thread.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/faction.js --out /tmp/f.png --settle 300

import { THREE, FACTION, easeOut, easeIn, easeInOut } from './kit.js';
import { threads as weave } from './thread.js';

export function cast(kit, at, faction) {
    const p = kit.at(at);
    if (!p) return;
    const look = FACTION[faction] || FACTION.Neutral;

    switch (faction) {
      case 'Auroxi':                                  // woven ribbons
        weave(kit, at, look.spark);
        break;
      case 'Refractory': {                            // a shaft of judgement
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
        break;
      }
      case 'Gloaming':                                // motes sinking, not rising
        kit.sparks(p, { colour: look.glow, count: 18, spread: 0.85, seconds: 0.85, rise: -0.5 });
        break;
      case 'Shardsworn': {                            // it comes apart in facets
        const mat = new THREE.MeshStandardMaterial({
          color: look.spark, emissive: look.spark, emissiveIntensity: 1.1,
          transparent: true, roughness: 0.25, flatShading: true,
        });
        const g = new THREE.Group();
        const dir = [];
        for (let i = 0; i < 9; i++) {
          const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.17), mat);
          g.add(sh);
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
        break;
      }
      case 'Marvorren': {                             // a ripple, and then another
        kit.ring(p, look.spark, { size: 2.2, seconds: 0.6 });
        kit.anim.add(0.18, () => {}, () => kit.anim.ring(null, {
          at: p, colour: look.spark, size: 3.0, seconds: 0.7,
        }));
        kit.sparks(p, { colour: look.glow, count: 9, spread: 1.1, seconds: 0.55, rise: 0.5 });
        break;
      }
      default:
        kit.sparks(p, { colour: look.glow, count: 13, spread: 0.75, seconds: 0.55, rise: 1.2 });
        kit.ring(p, look.spark, { size: 1.6, seconds: 0.5 });
    }
  }

export function volley(kit, from, targets = []) {
    const a = kit.at(from);
    if (!a) return;
    const tex = blobTexture('rgba(255,235,190,1)', 'rgba(255,200,120,0)');
    for (const [i, t] of targets.entries()) {
      const b = kit.at(t);
      if (!b) continue;
      const shot = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      shot.scale.set(0.7, 0.18, 1);
      kit.hold(shot, 0.5, (k) => {
        const t2 = Math.min(1, Math.max(0, (k - i * 0.06) / 0.6));
        shot.position.copy(a).lerp(b, easeIn(t2));
        shot.position.y += 0.5 + Math.sin(Math.PI * t2) * 1.5;
        shot.material.opacity = t2 >= 1 ? 0 : 1;
        if (t2 >= 1 && !shot.userData.hit) {
          shot.userData.hit = true;
          kit.sparks(b, { colour: 'rgba(255,220,160,1)', count: 8, spread: 0.6, seconds: 0.4 });
        }
      });
    }
  }
