// What a card LOOKS like when it goes off.
//
// The rules leave a note on `state.fx` saying what happened — "this was a
// Convict", "this was a Fire Bolt" — because only the rules know that. Nothing
// here can change the game; it is all read after the fact, like the rest of
// the animation.
//
// ONE EFFECT, ONE FILE, under ./fx/effects/. They are worked on one at a time
// and a shared file is a shared traffic jam. ./fx/kit.js holds what they all
// need; ./fx/cloth-kit.js and ./fx/iron-kit.js hold what a family shares.
// ./fx/reference/ is earlier work kept only to read, and is imported by
// nothing.

import { Kit } from './fx/kit.js';
import { bolt } from './fx/cloth.js';
import { chains } from './fx/effects/chains.js';
import { brand } from './fx/effects/brand.js';
import { shardfire } from './fx/effects/shardfire.js';
import { threads } from './fx/effects/thread.js';
import { volley } from './fx/effects/volley.js';
import { cast as castAuroxi } from './fx/effects/cast-auroxi.js';
import { cast as castRefractory } from './fx/effects/cast-refractory.js';
import { cast as castGloaming } from './fx/effects/cast-gloaming.js';
import { cast as castShardsworn } from './fx/effects/cast-shardsworn.js';
import { cast as castMarvorren } from './fx/effects/cast-marvorren.js';

const CAST = {
  Auroxi: castAuroxi,
  Refractory: castRefractory,
  Gloaming: castGloaming,
  Shardsworn: castShardsworn,
  Marvorren: castMarvorren,
};

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
        case 'cast': (CAST[ev.faction] || CAST.Marvorren)(k, ev.at, ev.faction); break;
        default: break;
      }
    } catch (e) {
      // A broken flourish must never take the table down with it.
      console.warn('fx', ev.kind, e);
    }
  }
}
