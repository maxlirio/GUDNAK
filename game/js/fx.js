// What a card LOOKS like when it goes off.
//
// The rules leave a note on `state.fx` saying what happened — "this was a
// Convict", "this was a Fire Bolt" — because only the rules know that. Nothing
// here can change the game; it is all read after the fact, like the rest of
// the animation.
//
// The motifs themselves live in ./fx/, one file per family, because they are
// worked on one at a time and a shared file is a shared traffic jam. This is
// only the switchboard.

import { Kit } from './fx/kit.js';
import { bolt } from './fx/cloth.js';
import { chains, brand } from './fx/iron.js';
import { shardfire } from './fx/shard.js';
import { threads } from './fx/thread.js';
import { cast, volley } from './fx/faction.js';

export class Fx {
  constructor(scene, anim, pieces) {
    this.kit = new Kit(scene, anim, pieces);
  }

  play(ev) {
    if (!ev) return;
    const k = this.kit;
    try {
      switch (ev.kind) {
        case 'chains': chains(k, ev.from, ev.to); break;
        case 'brand': brand(k, ev.target); break;
        case 'volley': volley(k, ev.from, ev.targets || []); break;
        case 'bolt': bolt(k, ev.bolt, ev.from, ev.to, ev); break;
        case 'threads': threads(k, ev.at, ev.colour); break;
        case 'shardfire': shardfire(k, ev.at); break;
        case 'cast': cast(k, ev.at, ev.faction); break;
        default: break;
      }
    } catch (e) {
      // A broken flourish must never take the table down with it.
      console.warn('fx', ev.kind, e);
    }
  }
}
