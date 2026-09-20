// THE AUROXI FLOURISH — nomads of cloth and thread — teal and orange, woven ribbons.
//
// What a Auroxi card does when it resolves and has no motif of its own,
// which is MOST of them. This is the effect a player sees more often than any
// other, so restraint matters here more than spectacle.
//
// One effect, one file. This is a plain starting point, not a finished thing.

import { THREE, FACTION, easeOut, easeIn, easeInOut } from '../kit.js';
import { threads as weave } from './thread.js';

export function cast(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION['Auroxi'] || FACTION.Neutral;

  weave(kit, at, look.spark);
}
