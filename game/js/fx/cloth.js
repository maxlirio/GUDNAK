// The bolts: one switchboard, six endings.
//
// Every bolt is a bolt of CLOTH — fabric rolled on a rod — so they all unroll,
// run out across the table and wind round the target the same way; that part
// lives in ./cloth-kit.js. What each one does once it HAS them is its own
// file under ./effects/, worked on one at a time.

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
