// A FIGHTER DISSOLVES and is sent back to its owner’s hand.
//
// Shared by 3 cards: R060, C073, C071.
// One motif, one file — worked on on its own.
//
// A PLAIN STARTING POINT, not a finished thing: it borrows the faction's
// flourish so that something happens, and is meant to be replaced.

import { THREE, FACTION, easeOut, easeIn, easeInOut } from '../kit.js';

export function bounce(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION['Shardsworn'] || FACTION.Neutral;
  kit.sparks(p, { colour: look.glow, count: 12, spread: 0.7, seconds: 0.55, rise: 1.1 });
  kit.ring(p, look.spark, { size: 1.7, seconds: 0.5 });
}
