// What a card LOOKS like when it goes off.
//
// The rules leave a note on `state.fx` saying what happened — "this was a
// Convict", "this was a Fire Bolt" — because only the rules know that. Nothing
// here can change the game; it is all read after the fact, like the rest of
// the animation.
//
// ONE MOTIF, ONE FILE, under ./fx/effects/. Which card uses which motif is in
// js/rules/motifs.js, because that is a question about the CARDS.

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
import { raise } from './fx/effects/raise.js';
import { harvest } from './fx/effects/harvest.js';
import { wither } from './fx/effects/wither.js';
import { possess } from './fx/effects/possess.js';
import { decree } from './fx/effects/decree.js';
import { phylactery } from './fx/effects/phylactery.js';
import { song } from './fx/effects/song.js';
import { tide } from './fx/effects/tide.js';
import { usher } from './fx/effects/usher.js';
import { depthcharge } from './fx/effects/depthcharge.js';
import { lashout } from './fx/effects/lashout.js';
import { shatterblast } from './fx/effects/shatterblast.js';
import { bounce } from './fx/effects/bounce.js';
import { arcane } from './fx/effects/arcane.js';
import { graft } from './fx/effects/graft.js';
import { stall } from './fx/effects/stall.js';
import { reveal } from './fx/effects/reveal.js';
import { recall } from './fx/effects/recall.js';
import { trapspring } from './fx/effects/trapspring.js';
import { entrance } from './fx/effects/entrance.js';
import { voidstep } from './fx/effects/voidstep.js';
import { wander } from './fx/effects/wander.js';

const CAST = {
  Auroxi: castAuroxi,
  Refractory: castRefractory,
  Gloaming: castGloaming,
  Shardsworn: castShardsworn,
  Marvorren: castMarvorren,
};

const MOTIF = {
  raise,
  harvest,
  wither,
  possess,
  decree,
  phylactery,
  song,
  tide,
  usher,
  depthcharge,
  lashout,
  shatterblast,
  bounce,
  arcane,
  graft,
  stall,
  reveal,
  recall,
  trapspring,
  entrance,
  voidstep,
  wander,
};

export class Fx {
  constructor(scene, anim, pieces) {
    this.kit = new Kit(scene, anim, pieces);
  }

  play(ev) {
    if (!ev) return;
    const k = this.kit;
    try {
      const motif = MOTIF[ev.kind];
      if (motif) { motif(k, ev.at, ev.faction); return; }
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
