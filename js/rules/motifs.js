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
  'M027': 'usher',
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
  // A CARD HAULED OFF A DECK into the light to be judged
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
};
