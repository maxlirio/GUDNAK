// VOLLEY — the Refractory tactic Barrage: a fan of shots loosed from one of
// your fighters at everything around it.
//
// One effect, one file.

import { THREE, FACTION, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { threads as weave } from './thread.js';

/**
 * BARRAGE — every enemy round the fighter gets one, all in the same breath.
 *
 * The weight is in the timing, not the size. A short gather at the shooter,
 * then the rounds leave 55ms apart so the impacts arrive as a roll rather than
 * a single thump, and the flight is fast and nearly flat — just enough loft to
 * clear the card between. The first version lobbed them on a tall arc over two
 * thirds of a second each, which made a siege engine out of a volley of shot.
 *
 * Each shot's whole life — gather, flight, impact spray, muzzle and impact
 * light — is one hold, because a hold started from inside another hold's tick
 * is dropped on the floor by the animator (see the note at the top of the
 * file). That is also why the old code's impact sparks never appeared even
 * before it threw: it called blobTexture without importing it, so the entire
 * tactic fell through fx.js's catch and drew nothing at all.
 */
export function volley(kit, from, targets = []) {
  const a = kit.at(from);
  if (!a) return;
  const look = FACTION.Refractory;
  const GLOW = 'rgba(255,238,196,1)';

  const marks = targets.map((t) => kit.at(t)).filter(Boolean);
  if (!marks.length) return;

  const muzzle = a.clone().setY(flatY(a) + 0.4);
  const WIND = 0.12, GAP = 0.038, FLY = 0.3, BOOM = 0.34;
  const SPAN = WIND + GAP * (marks.length - 1) + FLY + BOOM;

  // The gather: the fighter draws in before it looses. Without it the rounds
  // appeared out of nothing and the volley had no beginning.
  const charge = mote(GLOW, 0.3);
  charge.position.copy(muzzle);
  kit.hold(charge, WIND + 0.07, (t) => {
    const k = Math.min(1, t * (WIND + 0.07) / WIND);
    charge.scale.setScalar(0.22 + easeIn(k) * 1.0);
    charge.material.opacity = k < 1 ? 0.4 * k : 0.6 * (1 - (t - WIND / (WIND + 0.07)) * 14);
  });
  kit.ring(a.clone().setY(flatY(a)), look.spark, { size: 0.9, seconds: 0.45 });

  marks.forEach((b, i) => {
    const mark = b.clone().setY(flatY(b) + 0.14);
    const dir = mark.clone().sub(muzzle).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    // A fan has to be visible as a fan, so each round bows out to its own side
    // on the way: the spread then happens in the air and not only at the ends.
    const bow = (i - (marks.length - 1) / 2) * 0.24;
    const go = WIND + i * GAP;

    const g = new THREE.Group();            // identity transform: children are
    const shot = streak(1.35, 0.17, look.spark);  // placed in world coordinates
    shot.visible = false;
    const head = mote(GLOW, 0.42);
    head.material.opacity = 0.95;
    shot.add(head);
    g.add(shot);

    const muzzleFlash = mote(GLOW, 0.5);
    muzzleFlash.position.copy(muzzle);
    g.add(muzzleFlash);

    // Impact debris, thrown BACK the way the round came: the direction of the
    // spray is what gives the hit a sense of what hit it.
    const back = dir.clone().negate();
    const bits = [];
    for (let k = 0; k < 9; k++) {
      const s = mote(GLOW, 0.22);
      s.userData = new THREE.Vector3(
        back.x * (0.7 + Math.random() * 1.3) + side.x * (Math.random() - 0.5) * 1.4,
        1.0 + Math.random() * 1.3,
        back.z * (0.7 + Math.random() * 1.3) + side.z * (Math.random() - 0.5) * 1.4,
      );
      bits.push(s);
      g.add(s);
    }
    const burst = mote(GLOW, 0.3);
    burst.position.copy(mark);
    g.add(burst);

    const lamp = new THREE.PointLight(look.spark, 0, 3.2, 2);
    lamp.position.copy(mark).setY(mark.y + 0.3);
    g.add(lamp);

    const hereAt = (k) => {
      const q = muzzle.clone().lerp(mark, k);
      q.addScaledVector(side, Math.sin(Math.PI * k) * bow);
      q.y += Math.sin(Math.PI * k) * 0.34;
      return q;
    };

    let rang = false;
    kit.hold(g, SPAN, (t) => {
      const s = t * SPAN;
      const k = (s - go) / FLY;

      muzzleFlash.material.opacity = s < go || s > go + 0.09 ? 0
        : 0.5 * (1 - (s - go) / 0.09);
      muzzleFlash.scale.setScalar(0.35 + (s - go) * 6);

      if (k > 0 && k < 1) {
        shot.visible = true;
        shot.position.copy(hereAt(k));
        shot.lookAt(hereAt(Math.min(1, k + 0.07)));
        shot.material.opacity = 0.8 * Math.min(1, k * 7);
      } else {
        shot.visible = false;
      }

      const hit = (s - go - FLY) / BOOM;
      if (hit < 0) return;
      if (!rang) {
        rang = true;
        kit.ring(b.clone().setY(flatY(b)), look.spark, { size: 1.1, seconds: 0.35 });
      }
      for (const bit of bits) {
        const v = bit.userData;
        bit.position.copy(mark);
        bit.position.x += v.x * hit;
        bit.position.z += v.z * hit;
        bit.position.y += v.y * hit - hit * hit * 2.2;
        bit.material.opacity = (1 - hit) ** 1.1;
        bit.scale.setScalar(0.2 * (1 - hit * 0.5));
      }
      burst.scale.setScalar(0.35 + easeOut(Math.min(1, hit * 4)) * 1.0);
      burst.material.opacity = 0.85 * (1 - Math.min(1, hit * 3.6)) ** 1.5;
      lamp.intensity = 9 * (1 - Math.min(1, hit * 3)) ** 1.5;
    });
  });
}
