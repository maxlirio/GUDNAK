// THE GLOAMING FLOURISH — the undead — purple motes that SINK into the dark rather than rising.
//
// What a Gloaming card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// One effect, one file. This is a plain starting point, not a finished thing.

import { THREE, FACTION, easeOut, easeIn, easeInOut } from '../kit.js';

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION['Gloaming'] || FACTION.Neutral;

  kit.sparks(p, { colour: look.glow, count: 18, spread: 0.85, seconds: 0.85, rise: -0.5 });
}
