// What a card LOOKS like when it goes off.
//
// The rules leave a note on `state.fx` saying what happened — "this was a
// Convict", "this was a Fire Bolt" — because only the rules know that. Nothing
// here can change the game; it is all read after the fact, like the rest of
// the animation.
//
// ONE MOTIF, ONE FILE, under ./fx/effects/. Which card uses which motif is in
// js/rules/motifs.js, because that is a question about the CARDS.
//
// A motif may also export two things beyond its animation, and both exist
// because an effect and the card it happens to were drifting apart:
//
//   timing.kill   how long the card must STAY ON THE TABLE afterwards. The
//                 engine resolves instantly, so without this the card is gone
//                 before the fire reaches it.
//   exit.destroy  what the card DOES when it leaves. If a motif burns a card
//   exit.hand     up, the card has to burn up and go — not burn up and then be
//                 struck flat and thrown on the pile by the generic death
//                 playing on top of it. Whoever showed how it died owns its
//                 leaving.

import { Kit } from './fx/kit.js';
import { bolt } from './fx/cloth.js';
import * as cloth from './fx/cloth.js';
import * as chainsMod from './fx/effects/chains.js';
import * as brandMod from './fx/effects/brand.js';
import * as shardfireMod from './fx/effects/shardfire.js';
import * as threadsMod from './fx/effects/thread.js';
import * as volleyMod from './fx/effects/volley.js';
import { cast as castAuroxi } from './fx/effects/cast-auroxi.js';
import { cast as castRefractory } from './fx/effects/cast-refractory.js';
import { cast as castGloaming } from './fx/effects/cast-gloaming.js';
import { cast as castShardsworn } from './fx/effects/cast-shardsworn.js';
import { cast as castMarvorren } from './fx/effects/cast-marvorren.js';
import * as raiseMod from './fx/effects/raise.js';
import * as harvestMod from './fx/effects/harvest.js';
import * as witherMod from './fx/effects/wither.js';
import * as possessMod from './fx/effects/possess.js';
import * as decreeMod from './fx/effects/decree.js';
import * as phylacteryMod from './fx/effects/phylactery.js';
import * as songMod from './fx/effects/song.js';
import * as tideMod from './fx/effects/tide.js';
import * as usherMod from './fx/effects/usher.js';
import * as depthchargeMod from './fx/effects/depthcharge.js';
import * as lashoutMod from './fx/effects/lashout.js';
import * as shatterblastMod from './fx/effects/shatterblast.js';
import * as bounceMod from './fx/effects/bounce.js';
import * as arcaneMod from './fx/effects/arcane.js';
import * as graftMod from './fx/effects/graft.js';
import * as stallMod from './fx/effects/stall.js';
import * as revealMod from './fx/effects/reveal.js';
import * as recallMod from './fx/effects/recall.js';
import * as trapspringMod from './fx/effects/trapspring.js';
import * as entranceMod from './fx/effects/entrance.js';
import * as voidstepMod from './fx/effects/voidstep.js';
import * as wanderMod from './fx/effects/wander.js';
import * as moonphaseMod from './fx/effects/moonphase.js';
import * as moonriseMod from './fx/effects/moonrise.js';
import * as maelstromMod from './fx/effects/maelstrom.js';
import * as buryMod from './fx/effects/bury.js';
import * as attachMod from './fx/effects/attach.js';
import * as voidlinkMod from './fx/effects/voidlink.js';
import * as echoMod from './fx/effects/echo.js';
import * as gustMod from './fx/effects/gust.js';
import * as decoyMod from './fx/effects/decoy.js';
import * as haulMod from './fx/effects/haul.js';
import * as bulwarkMod from './fx/effects/bulwark.js';
import * as arriveMod from './fx/effects/arrive.js';
import * as triangleMod from './fx/effects/triangle.js';

const CAST = {
  Auroxi: castAuroxi,
  Refractory: castRefractory,
  Gloaming: castGloaming,
  Shardsworn: castShardsworn,
  Marvorren: castMarvorren,
};

/**
 * Every motif module, by the `kind` the rules write on state.fx. The whole
 * module, not just its animation, so the exit and the timing that belong to a
 * motif travel with it instead of in a table over here that drifts out of date.
 */
const MOD = {
  bolt: cloth,
  chains: chainsMod,
  brand: brandMod,
  shardfire: shardfireMod,
  threads: threadsMod,
  volley: volleyMod,
  raise: raiseMod,
  harvest: harvestMod,
  wither: witherMod,
  possess: possessMod,
  decree: decreeMod,
  phylactery: phylacteryMod,
  song: songMod,
  tide: tideMod,
  usher: usherMod,
  depthcharge: depthchargeMod,
  lashout: lashoutMod,
  shatterblast: shatterblastMod,
  bounce: bounceMod,
  arcane: arcaneMod,
  graft: graftMod,
  stall: stallMod,
  reveal: revealMod,
  recall: recallMod,
  trapspring: trapspringMod,
  entrance: entranceMod,
  voidstep: voidstepMod,
  wander: wanderMod,
  // The Masked's moon: it counts turns beside the Stronghold, turns over into
  // Charybdis, and then drags fighters in. Three events for one card.
  moonphase: moonphaseMod,
  moonrise: moonriseMod,
  maelstrom: maelstromMod,
  // The last of the generic flourishes, replaced one family at a time.
  bury: buryMod,
  attach: attachMod,
  voidlink: voidlinkMod,
  echo: echoMod,
  gust: gustMod,
  decoy: decoyMod,
  haul: haulMod,
  bulwark: bulwarkMod,
  arrive: arriveMod,
  triangle: triangleMod,
};

/**
 * The motifs driven by js/rules/motifs.js. These and only these take
 * (kit, at, faction) — see `play`.
 */
const TABLE = new Set([
  'raise', 'harvest', 'wither', 'possess', 'decree', 'phylactery', 'song',
  'tide', 'usher', 'depthcharge', 'lashout', 'shatterblast', 'bounce',
  'arcane', 'graft', 'stall', 'reveal', 'recall', 'trapspring', 'entrance',
  'voidstep', 'wander', 'moonphase', 'moonrise', 'maelstrom',
  'bury', 'attach', 'voidlink', 'echo', 'gust', 'decoy', 'haul', 'bulwark', 'arrive', 'triangle',
]);

/**
 * The hand-written motifs predate `timing`, and their waits were measured
 * against the finished animation rather than declared by it. Kept here so
 * nothing regresses; a motif that exports its own `timing.kill` wins.
 */
const LEGACY_KILL = {
  bolt: 1.19,          // the cloth pulls tight at 0.61 of a 1.95s throw
  volley: 0.34,        // time of flight
  chains: 0,           // the haul IS the aftermath; the card has already moved
  brand: 0,
  threads: 0,
  shardfire: 0,        // thrown as they die, and it looks right that way
  cast: 0,
};

export class Fx {
  constructor(scene, anim, pieces) {
    this.kit = new Kit(scene, anim, pieces);
    // Set by the table. Called with (kind, worldPosition) for every effect, so
    // the camera can decide whether the moment is worth leaning in on. A hook
    // rather than an import: this file is about drawing and should know
    // nothing about the camera.
    this.onBig = null;
  }

  /**
   * Where an effect is HAPPENING, for anything that wants to point at it.
   *
   * The events do not agree on a field name — a motif carries `at`, a bolt
   * names its victim's square in `to`, a brand names `target` — and picking
   * the wrong one aims the camera at the caster instead of the casualty.
   */
  #where(ev) {
    for (const key of ['at', 'to', 'target']) {
      if (ev[key] == null) continue;
      const p = this.kit.at(ev[key]);
      if (p) return p;
    }
    return null;
  }

  play(ev) {
    if (!ev) return;
    const k = this.kit;
    try {
      if (this.onBig) {
        try { this.onBig(ev.kind, this.#where(ev)); } catch { /* never block the effect */ }
      }
      // Only the table-driven motifs share one signature. The hand-written
      // ones each take their own arguments — looking them up by name here
      // called every one of them as motif(kit, ev.at, ev.faction), which is
      // three wrong arguments and a bolt that never appeared.
      const motif = TABLE.has(ev.kind) ? MOD[ev.kind]?.[ev.kind] : null;
      if (motif) { motif(k, ev.at, ev.faction); return; }
      switch (ev.kind) {
        case 'chains': chainsMod.chains(k, ev.from, ev.to); break;
        case 'brand': brandMod.brand(k, ev.target); break;
        case 'volley': volleyMod.volley(k, ev.from, ev.targets || []); break;
        case 'bolt': bolt(k, ev.bolt, ev.from, ev.to, ev); break;
        case 'threads': threadsMod.threads(k, ev.at, ev.colour); break;
        case 'shardfire': shardfireMod.shardfire(k, ev.at); break;
        case 'cast': (CAST[ev.faction] || CAST.Marvorren)(k, ev.at, ev.faction); break;
        default: break;
      }
    } catch (e) {
      // A broken flourish must never take the table down with it.
      console.warn('fx', ev.kind, e);
    }
  }

  /**
   * How long the cards this action killed or moved must stay put, so the motif
   * can be seen to do it. One number for the whole action, like the board
   * diff it is applied to — in practice one effect resolves at a time.
   */
  killWait(events) {
    let w = 0;
    for (const ev of events || []) {
      const declared = MOD[ev.kind]?.timing?.kill;
      w = Math.max(w, declared ?? LEGACY_KILL[ev.kind] ?? 0);
    }
    return w;
  }

  /**
   * The leaving, if the motif that happened to this card wants to own it.
   * `fate` is 'destroy' (to the discard pile) or 'hand' (back to its owner).
   * Returns null when nothing claims it, and the table falls back to the
   * generic death.
   */
  exitFor(events, fate) {
    for (const ev of events || []) {
      const fn = MOD[ev.kind]?.exit?.[fate];
      if (!fn) continue;
      return (piece, square, done) => {
        try { fn(this.kit, piece, square, ev, done); } catch (e) {
          // Never strand a card on the board because its exit threw.
          console.warn('fx exit', ev.kind, e);
          done?.();
        }
      };
    }
    return null;
  }
}
