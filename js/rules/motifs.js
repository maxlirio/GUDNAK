// Which motif each card uses when it resolves.
//
// Cards that describe themselves — the Bolts, a Convict, a Barrage — leave
// their own note and never reach this table. Everything else would otherwise
// get its faction's generic flourish, which is fine for a plain fighter and a
// waste on a card that does something worth watching.
//
// Reuse is the point: everything that hauls a body up out of the graveyard
// looks the same, whichever card did it.

export const CARD_MOTIF = {
  // THE DEAD GET UP — a fighter deployed out of the graveyard
  'C084': 'raise',
  'C087': 'raise',
  'C110': 'raise',
  'A068': 'raise',
  'R072': 'raise',
  // SOMETHING IS DRAWN UP out of the graveyard and into your hand
  'R067': 'harvest',
  'R074': 'harvest',
  'C086': 'harvest',
  // DECAY — fighters destroyed by rot and pyre rather than by force
  'R076': 'wither',
  'C113': 'wither',
  // A SHADOW FLOWS OVER a fighter and takes its place on top of it
  'C083': 'possess',
  'A064': 'possess',
  // AN EDICT crossing the whole board and changing what is allowed
  'C079': 'decree',
  'M069': 'decree',
  'M066': 'decree',
  // A SOUL CAUGHT in a vessel instead of going to the graveyard
  'R073': 'phylactery',
  // SONG made visible — the Singers resonate and something obeys
  'M029': 'song',
  'M031': 'song',
  'M068': 'song',
  'M087': 'song',
  // A TIDE sweeping a whole row of fighters along with it
  'M035': 'tide',
  'M003': 'tide',
  'M041': 'tide',
  // A GUIDING PUSH — one fighter moved a single square by another
  'M007': 'usher',
  'M203': 'usher',
  // A CHARGE going off under the water in your own Back Row
  'M015': 'depthcharge',
  // A RANGED STRIKE — something reaches out and kills at a distance
  'M004': 'lashout',
  'M079': 'lashout',
  'C050': 'lashout',
  // CRYSTAL DETONATION — everything adjacent comes apart
  'R057': 'shatterblast',
  'C053': 'shatterblast',
  // A FIGHTER DISSOLVES and is sent back to its owner’s hand
  'R060': 'bounce',
  'C073': 'bounce',
  'C071': 'bounce',
  // CARDS SPENT FROM HAND become a blast
  'C070': 'arcane',
  // CRYSTAL VEINS link your fighters and share what they are
  'A058': 'graft',
  'A059': 'graft',
  'A053': 'graft',
  // PETRIFIED — a fighter is stopped rather than killed
  'C049': 'stall',
  'C076': 'stall',
  // A CARD HAULED OFF A DECK into the light to be judged.
  //
  // Restored after being deleted. The objection was real — the rules know
  // which card was revealed and this table never learns it, so the motif
  // turns over a face it drew itself rather than the true one — but it is an
  // argument for PASSING THE CARD THROUGH, not for having no picture at all,
  // and the effect was built and verified before it was cut. Whether a
  // deliberately generic, lamp-washed face is a lie or an abstraction is the
  // author's call to make, not mine.
  // A SUMMONS — something called back out of your graveyard
  'R053': 'reveal',
  'A045': 'reveal',
  'A047': 'reveal',
  // A SUMMONS — something called back out of your graveyard
  'C006': 'recall',
  // A TRAP FLIPS FACE UP and snaps shut
  'R062': 'trapspring',
  'R065': 'trapspring',
  // ENTRANCED — an enemy’s own abilities are taken away
  'R092': 'entrance',
  // A SHADOW SLIPS UNDER the board and comes up elsewhere
  'M199': 'voidstep',
  'M200': 'voidstep',
  'M204': 'voidstep',
  'M207': 'voidstep',
  // AN UNINVITED ARRIVAL beside an enemy stack
  'C164': 'wander',
  // A FIGHTER IS FORCED UNDERNEATH another — jailed, not killed.
  //
  // ONLY M165 IS HERE. The three Inquisition jailers — A042 Umbren Jailor,
  // A044 Heretic Condemner, A046 Incarceration — used to be mapped as well,
  // and they also emit their own `chains` note while they drag the victim in.
  // Both motifs then took hold of the SAME card, and `bury` registered second
  // so it won every frame: it shoved the card under the stack in a fifth of a
  // second while the irons were still in the air, leaving the chain stretched
  // across empty stone. That is exactly "the chains went after the card was
  // moved under".
  //
  // And it was never a second BEAT to begin with — ./fx/effects/chains.js
  // already ends on DROP, "the captor comes down on top of them", which is
  // the whole of what bury was being asked to add. It was a duplicate of the
  // last second of the motif that was already playing.
  //
  // M165 Shadowcaster slides a Shadow under a friend and throws no chains, so
  // `bury` is the only thing that moves that card and it stays.
  'M165': 'bury',
  // SOMETHING IS FIXED TO A FIGHTER — a bolt, a writ, a tapestry
  'A002': 'attach',
  'A005': 'attach',
  'A033': 'attach',
  'A050': 'attach',
  // A FIGHTER BORROWS what is standing in The Void
  'M178': 'voidlink',
  'M184': 'voidlink',
  'M187': 'voidlink',
  'Black Aurox': 'voidlink',
  'Living Stronghold': 'voidlink',
  // TIME IS BOUGHT — an extra action, or acting while spent
  //
  // Twain of Twine is deliberately NOT here. It copies another fighter's
  // ability and resolves it for real, through the same `run` the original
  // used, so the copied ability emits its OWN effect: a second Fire Bolt
  // should look like a Fire Bolt. Anything of Twain's own on top of that is
  // a second thing happening, which is the opposite of what the card does.
  'A010': 'echo',
  'A008': 'echo',
  // A WIND CROSSES THE WHOLE BOARD and shoves everything loose — except in
  // the Gates, which is why the motif has a second mark for the ones that
  // stand fast. It replaced `gust`, whose dark dust could not be seen at all
  // against a dark arena; see the head of fx/effects/steppe.js.
  'A040': 'steppe',
  // SOMETHING IS NOT WHAT IT SAYS IT IS.
  //
  // All THREE printings, and M027 was the one that mattered: it had been left
  // behind in `usher` from before this motif existed, so two of the Villagers
  // transformed and the third was politely nudged.
  'M025': 'decoy',
  'M026': 'decoy',
  'M027': 'decoy',
  // ONE FIGHTER DRAGS ANOTHER ALONG with it
  'A003': 'haul',
  // A FIGHTER IS BRIEFLY STRONGER THAN IT LOOKS
  'A007': 'bulwark',
  'A066': 'bulwark',
  // AN ARRIVAL FROM NOWHERE, anywhere on the field
  'C048': 'arrive',
  // THE TRAIT TRIANGLE BITES — the commonest thing in the game, and until now
  // the only rule with no picture at all. Emitted by the engine at the moment
  // an attack is resolved, not when a card is played.
  'triangle': 'triangle',

  // REUSE — these want a motif that already exists rather than one of their own
  'R063': 'trapspring',      // Explosive Trap: a facedown card that snaps
  'M040': 'trapspring',      // Jagged Rocks: the ground turns on an intruder
  'M166': 'voidstep',        // Veil Shearer relocates a friend into The Void

  // M162 VOIDSTRIDER IS DELIBERATELY NOT HERE, and putting it back breaks the
  // card. Shadow Step is two different pictures — a swap with a fighter in
  // The Void, or a lone step into an empty one — and this table cannot say
  // which happened: defaultCast hands a motif a uid and a faction and nothing
  // else. So cards.js emits the event itself, with the extra field the motif
  // needs (`with`: the other fighter, or null when he went alone). An entry
  // here on top of that is a SECOND voidstep from defaultCast, carrying no
  // `with`, which plays the two-way swap over the one-way departure.
  'A041': 'brand',           // the Lord High Inquisitor plays two Convictions
  'A038': 'decree',          // Migration moves where your Gates are
};
