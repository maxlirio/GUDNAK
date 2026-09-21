// Placeholder — the real motif is built by its own agent. See tools/fxdemo/decoy.js.
import { FACTION } from '../kit.js';

export function decoy(kit, at, faction) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION[faction] || FACTION.Neutral;
  kit.sparks(p, { colour: look.glow, count: 12 });
  kit.ring(p, look.spark, { size: 2.2, seconds: 0.45 });
}
