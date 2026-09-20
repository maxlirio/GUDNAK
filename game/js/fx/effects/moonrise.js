// Placeholder — the real motif is built by its own agent. See tools/fxdemo/moonrise.js.
import { FACTION } from '../kit.js';

export function moonrise(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const look = FACTION.Marvorren;
  kit.sparks(p, { colour: look.glow, count: 14 });
  kit.ring(p, look.spark, { size: 2.2, seconds: 0.5 });
}
