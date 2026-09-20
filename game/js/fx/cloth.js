// The bolts: one switchboard, six endings.
//
// Every bolt is a bolt of CLOTH — fabric rolled on a rod — so they all unroll,
// run out across the table and wind round the target the same way; that part
// lives in ./cloth-kit.js. What each one does once it HAS them is its own
// file under ./effects/, worked on one at a time.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from './kit.js';
import { ribbon } from './cloth-kit.js';
import { burn } from './effects/fire.js';
import { freeze } from './effects/ice.js';
import { heave } from './effects/earth.js';
import { blink } from './effects/lightning.js';
import { drag } from './effects/shadow.js';
import { doom } from './effects/doom.js';

const LOOK = {
  fire:      { colour: 0xff7a2a, glow: 'rgba(255,140,60,1)' },
  ice:       { colour: 0x8fd8ff, glow: 'rgba(170,225,255,1)' },
  earth:     { colour: 0xbf9758, glow: 'rgba(210,170,110,1)' },
  lightning: { colour: 0xffe14a, glow: 'rgba(255,240,130,1)' },
  shadow:    { colour: 0x9a72d6, glow: 'rgba(160,120,225,1)' },
  doom:      { colour: 0xd8455a, glow: 'rgba(230,90,110,1)' },
};

/** What the cloth turns into as it takes hold, per bolt. */
const GRIP = {
  fire:      (c) => { c.flash(0xffb050, 1.0); c.recolour(0xff9028, 0.5); },
  ice:       (c) => { c.flash(0xbfeaff, 0.8); c.recolour(0xa8ddff, 0.85); c.stiffen(1); },
  earth:     (c) => { c.flash(0xffe0a8, 0.5); },
  lightning: (c) => { c.flash(0xffffd0, 1.0); },
  shadow:    (c) => { c.flash(0xd9b8ff, 0.6); c.recolour(0x3b2560, 0.75); },
  doom:      (c) => { c.flash(0xffc0c8, 0.9); c.recolour(0xff5f72, 0.5); },
};

export function bolt(kit, kind, from, to, extra = {}) {
  // kit.at gives a square y 0.4 and a card y 0.2. Everything below assumes the
  // card's face, and ground decals go ABOVE it — the first scorch and the
  // first shadow pool were drawn at table height and so were hidden under the
  // very card they were meant to mark.
  const face = (p) => (p ? p.clone().setY(0.21) : null);
  const a = face(kit.at(from));
  const b = face(kit.at(to)) || a;
  if (!a) return;

  // The rules write the destination as `toSquare`; `to` is the fighter the
  // bolt has hold of. Reading `to` here meant earth shoved them at their own
  // square (a zero-length direction, so a NaN slab) and lightning put them
  // back down where they started.
  const dest = extra.toSquare != null ? face(kit.at(extra.toSquare)) : null;
  const look = LOOK[kind] || { colour: 0xffc46a, glow: 'rgba(255,200,120,1)' };

  const away = b.clone().sub(a).setY(0);
  if (away.lengthSq() < 1e-6) away.set(0, 0, -1);
  away.normalize();

  // The cloth only ever changes its own look from inside its tick; everything
  // else is staged from out here, where the animator will not eat it.
  const cloth = ribbon(kit, a, b, look, {
    onGrip: () => (GRIP[kind] || GRIP.doom)(cloth),
  });

  const w = cloth.grip;
  if (kind === 'fire') burn(kit, w, b, look);
  else if (kind === 'ice') freeze(kit, w, b, look);
  else if (kind === 'earth') heave(kit, w, b, dest, away, look);
  else if (kind === 'lightning') blink(kit, w, b, dest, look);
  else if (kind === 'shadow') drag(kit, w, b, look);
  else doom(kit, w, b, look);
}

/* ------------------------------------------------------- what becomes of it */

/**
 * How long the card must stay after the rules have killed it: the cloth pulls
 * tight at 0.61 of a 1.95s throw, and nothing may be seen to die before that.
 */
export const timing = { kill: 1.19 };

const ASH = new Map();
/** A ragged flake, painted once and kept — a round sprite reads as a spark. */
function flakeTex(key, ragged) {
  let t = ASH.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 32 * (ragged ? 0.45 + Math.random() * 0.5 : 0.8);
    const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  ASH.set(key, t);
  return t;
}

/**
 * A card the Fire Bolt burnt has to BURN AWAY. The generic death struck it
 * flat, threw it on the discard pile and put a red burst under it — so a
 * fighter killed by fire died twice, once in the blaze and once again in a
 * motion that knew nothing about fire, and the bolt read as something that had
 * merely happened nearby.
 *
 * Earth shoves and lightning blinks; neither of those kills by itself, so when
 * one of them is what is on screen the ordinary death is still the right one.
 */
export const exit = {
  destroy(kit, piece, square, ev, done) {
    if (ev?.bolt !== 'fire') { kit.anim.destroy(piece, square, done); return; }

    const at = piece.group.position.clone();
    const toward = kit.grave(piece.owner).sub(at).setY(0).normalize();
    piece.animating = true;

    // Embers first — off the card while there is still fire on it — then ash,
    // which outlives the flame and is the only thing left at the end.
    const embers = new THREE.Group();
    const ash = new THREE.Group();
    const drift = [];
    for (let i = 0; i < 26; i++) {
      const hot = i < 12;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flakeTex(hot ? 'ember' : `ash${i % 4}`, !hot),
        color: hot ? 0xff8a34 : 0x2a2420,
        transparent: true, depthWrite: false,
        blending: hot ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      s.position.copy(at)
        .addScaledVector(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * CARD_W * 0.9)
        .addScaledVector(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * CARD_H * 0.9);
      s.position.y = at.y + 0.06;
      s.scale.setScalar(hot ? 0.10 + Math.random() * 0.07 : 0.13 + Math.random() * 0.10);
      drift.push({
        hot,
        // ash waits for the fire to be past its peak; before that it is a
        // dark thing on a bright one and simply does not exist on screen
        born: hot ? Math.random() * 0.18 : 0.55 + Math.random() * 0.7,
        rise: (hot ? 1.5 : 0.75) * (0.6 + Math.random() * 0.8),
        // ash is carried toward the pile it is going to; embers just boil up
        side: toward.clone().multiplyScalar(hot ? 0.1 : 0.55 + Math.random() * 0.5)
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)),
        home: s.position.clone(),
      });
      (hot ? embers : ash).add(s);
    }

    const SPAN = 1.25;
    // The ash OUTLIVES the card, and has to: while the blaze is still on the
    // square, dark flakes over fire are invisible, so every one of them was
    // wasted in the first cut. They now drift on for another second over bare
    // lit stone, which is the only part of this that says where the card went.
    const ASH_SPAN = 2.3;
    for (const g of [embers, ash]) for (const s of g.children) s.visible = false;

    kit.hold(embers, SPAN, (t) => step(embers, 0, t * SPAN));
    kit.hold(ash, ASH_SPAN, (t) => step(ash, 12, t * ASH_SPAN));

    function step(grp, from, sec) {
      for (let i = 0; i < grp.children.length; i++) {
        const s = grp.children[i];
        const d = drift[from + i];
        const age = sec - d.born;
        if (age < 0) { s.visible = false; continue; }
        s.visible = true;
        const life = Math.min(1, age / (d.hot ? 0.55 : 1.5));
        s.position.copy(d.home)
          .addScaledVector(d.side, age)
          .setY(d.home.y + d.rise * age - (d.hot ? 0 : 0.9 * age * age));
        s.material.opacity = d.hot
          ? (1 - life) * (life < 0.15 ? life / 0.15 : 1)
          : 0.85 * (1 - life ** 2);
        if (!d.hot) s.material.rotation = age * 2.4 * (i % 2 ? 1 : -1);
      }
    }

    // The card itself: blackening, buckling, gone. It does NOT travel to the
    // pile — there is nothing left of it to travel. The ash is what goes.
    const edge = piece.card3d.material[0];
    const mats = [piece.frontMat, piece.backMat, edge];
    for (const m of mats) { m.transparent = true; }
    const baseCol = mats.map((m) => m.color.clone());

    kit.anim.add(SPAN, (t) => {
      const char = Math.min(1, t / 0.30);
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(baseCol[i]).multiplyScalar(1 - 0.94 * char);
      }
      // buckling: one corner lifts as the fibres go, and the whole slab
      // shrinks toward its middle rather than sliding anywhere
      const b = easeOut(char);
      piece.tilt.rotation.x = -0.20 * b;
      piece.tilt.rotation.z = 0.13 * b;
      piece.group.position.y = at.y + 0.05 * b;
      const gone = Math.max(0, (t - 0.34) / 0.66);
      piece.group.scale.setScalar(1 - 0.24 * easeIn(Math.min(1, gone)));
      for (const m of mats) m.opacity = 1 - Math.min(1, gone) ** 1.6;
    }, () => {
      // Restore what was borrowed: pieces are pooled, and a card that came
      // back from the pool still charred and half transparent was a ghost.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(baseCol[i]);
        mats[i].opacity = 1;
      }
      piece.tilt.rotation.set(0, 0, 0);
      piece.group.scale.setScalar(1);
      piece.animating = false;
      done?.();
    });
  },
};
