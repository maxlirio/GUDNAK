// THE BRAND — hot iron pressed onto a card, glowing, smoking, cooling.
//
// One effect, one file.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { burst, glow, restOf } from '../iron-kit.js';

/**
 * THE BRAND — a hot iron pressed onto the card.
 *
 * The beats are the ones a real branding has and the old version had none of:
 * it falls, it LANDS (flash, sparks, the card flinching under it), it is held
 * there smoking, it is pulled away, and only then is the mark visible — white,
 * then orange, then dark char that fades. The cooling is the whole point; a
 * mark that appears and disappears at the same colour is a decal.
 */
export function brand(kit, target) {
  const at = kit.at(target);
  if (!at) return;
  const yaw = 0.18;
  const iron = brandIron();
  const rest = at.y + 0.1;                 // the ring's tube lying on the face
  iron.group.position.copy(at).setY(rest + 2.4);
  iron.group.rotation.y = yaw + 0.9;

  // A shaft of hard white light, because a Refractory tool does not simply
  // appear on the table: it comes down out of the inquisitor's own light.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.85, 3.4, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff0cc, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.copy(at).setY(at.y + 1.7);
  kit.hold(beam, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    beam.material.opacity = s < B.FALL
      ? 0.22 * easeOut(s / B.FALL)
      : 0.22 * Math.max(0, 1 - (s - B.FALL) / 0.45) ** 2;
  });

  const mark = scorch(at, yaw);
  mark.group.visible = false;
  kit.hold(mark.group, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    if (s < B.FALL) return;
    mark.group.visible = true;
    const k = Math.min(1, Math.max(0, (s - B.CLEAR) / (B.COOL - B.CLEAR)));
    const hot = 1 - k;
    const out = s > B.COOL ? Math.max(0, 1 - (s - B.COOL) / (B.TOTAL - B.COOL)) : 1;
    // white -> yellow -> orange -> dull red, which is iron losing its heat
    mark.heat.color.setRGB(1, 0.95 - 0.6 * k * k, Math.max(0, 0.8 - 2 * k));
    mark.heat.opacity = (s < B.CLEAR ? 1 : 0.3 + 0.7 * hot * hot) * out;
    mark.char.opacity = Math.min(0.85, (s - B.FALL) * 2.2) * out;
  });

  kit.hold(iron.group, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    if (s < B.FALL) {
      // dropped, not lowered: slow at the top, fast into the card
      const k = s / B.FALL;
      iron.group.position.y = rest + 2.4 * (1 - easeIn(k));
      iron.group.rotation.y = yaw + 0.9 * (1 - easeOut(k));
      iron.head.emissiveIntensity = 2.4 + 0.9 * k;
    } else if (s < B.PRESS) {
      // pressed hard and held; the shudder is the hand behind it
      const k = (s - B.FALL) / (B.PRESS - B.FALL);
      iron.group.position.y = rest - 0.03 * Math.exp(-k * 7) + 0.004 * Math.sin(s * 47);
      iron.group.rotation.y = yaw;
      iron.head.emissiveIntensity = 3.3 - 0.6 * k;
    } else {
      // lifted straight off, and gone before it can be looked at too closely
      const k = Math.min(1, (s - B.PRESS) / 0.5);
      iron.group.position.y = rest + easeIn(k) * 2.4;
      iron.head.emissiveIntensity = 2.7 * (1 - k);
      iron.head.opacity = Math.max(0, 1 - k * 1.4);
      iron.cold.opacity = Math.max(0, 1 - k * 1.4);
      iron.group.visible = k < 1;
    }
  });

  // The card takes the press: down under the iron, then back with a wobble.
  const home = restOf(kit.piece(target)) || at.clone();
  kit.hold(new THREE.Object3D(), B.PRESS + 0.4, (t) => {
    const s = t * (B.PRESS + 0.4);
    const p = kit.piece(target);
    if (!p || s < B.FALL - 0.02) return;
    p.animating = true;
    const k = s - B.FALL;
    p.group.position.copy(home);
    p.group.position.y -= 0.035 * Math.exp(-k * 4.5) * Math.cos(k * 13);
  }, () => {
    const p = kit.piece(target);
    if (p) { p.group.position.copy(home); p.animating = false; }
  });

  // contact, and then the iron dragging a little of the burn up with it
  glow(kit, at.clone().setY(at.y + 0.3), 0xfff2d2,
    { power: 26, delay: B.FALL, life: 0.4, total: B.TOTAL, reach: 6 });
  burst(kit, at.clone().setY(at.y + 0.07), {
    colour: 'rgba(255,190,110,1)', count: 18, spread: 1.15, rise: 0.8, size: 0.28,
    delay: B.FALL, life: 0.55, total: B.TOTAL,
  });
  burst(kit, at.clone().setY(at.y + 0.1), {
    colour: 'rgba(255,150,70,1)', count: 7, spread: 0.25, rise: 1.5, size: 0.2,
    delay: B.PRESS, life: 0.6, total: B.TOTAL, gravity: 0.2,
  });
  glow(kit, at.clone().setY(at.y + 0.25), 0xff9a4a,
    { power: 9, delay: B.PRESS, life: 0.5, total: B.TOTAL, reach: 5 });
  smoke(kit, at, { count: 18, delay: B.FALL, total: B.TOTAL });
  kit.after(B.FALL, () => kit.ring(at.clone().setY(at.y + 0.03), 0xffb469,
    { size: 2.2, seconds: 0.45 }));
}
