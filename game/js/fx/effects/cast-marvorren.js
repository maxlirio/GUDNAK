// THE MARVORREN FLOURISH — water — blue-green, ripples spreading.
//
// What a Marvorren card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// One effect, one file. This is a plain starting point, not a finished thing.

import { THREE, FACTION, easeOut, easeIn, easeInOut } from '../kit.js';

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION['Marvorren'] || FACTION.Neutral;

  kit.ring(p, look.spark, { size: 2.2, seconds: 0.6 });
  kit.after(0.18, () => kit.ring(p, look.spark, { size: 3.0, seconds: 0.7 }));
  kit.sparks(p, { colour: look.glow, count: 9, spread: 1.1, seconds: 0.55, rise: 0.5 });
}
