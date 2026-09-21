// A bench for looking at every card effect without playing sixteen games.
//
// DEV ONLY, and meant to be deleted: it is loaded only when the page is opened
// with ?fxlab=1, and nothing else imports it. Removing this file and the two
// lines in main.js that reach for it takes the whole thing out.

const EFFECTS = [
  { group: 'Bolts — a bolt of cloth unrolls, winds round them, then acts',
    items: [
      { id: 'fire', name: 'Fire Bolt', note: 'burns them up inside the cloth',
        ev: (b) => ({ kind: 'bolt', bolt: 'fire', from: b.me, to: b.foe }) },
      { id: 'ice', name: 'Ice Bolt', note: 'freezes a trait out of them; they survive, rimed',
        ev: (b) => ({ kind: 'bolt', bolt: 'ice', from: b.me, to: b.foe }) },
      { id: 'earth', name: 'Earth Bolt', note: 'heaves them a square sideways',
        ev: (b) => ({ kind: 'bolt', bolt: 'earth', from: b.me, to: b.foe, toSquare: 8 }) },
      { id: 'lightning', name: 'Lightning Bolt', note: 'wraps YOUR fighter and blinks them away',
        ev: (b) => ({ kind: 'bolt', bolt: 'lightning', from: b.me, to: b.me, toSquare: 8 }) },
      { id: 'shadow', name: 'Gloom Bolt', note: 'drops them into The Void',
        ev: (b) => ({ kind: 'bolt', bolt: 'shadow', from: b.me, to: b.foe }) },
      { id: 'doom', name: 'Doom Bolt', note: 'goes off where it stands, takes the neighbours',
        ev: (b) => ({ kind: 'bolt', bolt: 'doom', from: b.me, to: b.me }) },
    ] },
  { group: 'Refractory — irons and fire',
    items: [
      { id: 'chains', name: 'Chains', note: 'Incarceration, Catch, Man Catcher, a Convict rescue',
        ev: (b) => ({ kind: 'chains', from: b.friend, to: b.foe }) },
      { id: 'brand', name: 'The Brand', note: 'convicting someone of heresy',
        ev: (b) => ({ kind: 'brand', target: b.foe }) },
      { id: 'volley', name: 'Barrage', note: 'a fusillade around one of your fighters',
        ev: (b) => ({ kind: 'volley', from: b.me, targets: [5, 1, 7] }) },
    ] },
  { group: 'Named',
    items: [
      { id: 'shardfire', name: 'Shard Dragon fire', note: 'thrown for EVERY death it causes',
        ev: (b) => ({ kind: 'shardfire', at: b.foe }) },
      { id: 'shardchain', name: 'Shard fire — a chain of five', note: 'what Lay Waste actually looks like',
        ev: (b) => ({ kind: 'shardfire', at: b.foe }), chain: [3, 5, 1, 7, 8] },
      { id: 'thread', name: "Weavers' thread", note: 'Fatewoven Tapestry forbidding an action',
        ev: (b) => ({ kind: 'threads', at: b.me }) },
    ] },
  { group: 'Faction flourishes — every other card that resolves',
    items: [
      { id: 'cast-auroxi', name: 'Auroxi', note: 'bunting crossing sideways on the wind',
        ev: (b) => ({ kind: 'cast', at: b.me, faction: 'Auroxi' }) },
      { id: 'cast-refractory', name: 'Refractory', note: 'a stamp of light pressed down',
        ev: (b) => ({ kind: 'cast', at: b.me, faction: 'Refractory' }) },
      { id: 'cast-gloaming', name: 'Gloaming', note: 'motes sinking into the dark',
        ev: (b) => ({ kind: 'cast', at: b.me, faction: 'Gloaming' }) },
      { id: 'cast-shardsworn', name: 'Shardsworn', note: 'crystal growing, then breaking',
        ev: (b) => ({ kind: 'cast', at: b.me, faction: 'Shardsworn' }) },
      { id: 'cast-marvorren', name: 'Marvorren', note: 'water running across the card',
        ev: (b) => ({ kind: 'cast', at: b.me, faction: 'Marvorren' }) },
    ] },

  { group: 'Gloaming — the dead and the dark',
    items: [
      { id: 'raise', name: 'Raise', note: 'a fighter deployed out of the graveyard',
        ev: (b) => ({ kind: 'raise', at: b.me }) },
      { id: 'harvest', name: 'Harvest', note: 'something drawn up out of the graveyard into your hand',
        ev: (b) => ({ kind: 'harvest', at: b.me }) },
      { id: 'wither', name: 'Wither', note: 'destroyed by rot and pyre rather than force',
        ev: (b) => ({ kind: 'wither', at: b.me }) },
      { id: 'possess', name: 'Possess', note: 'a shadow flows over a fighter and takes its place',
        ev: (b) => ({ kind: 'possess', at: b.me }) },
      { id: 'decree', name: 'Decree', note: 'an edict crossing the board',
        ev: (b) => ({ kind: 'decree', at: b.me }) },
      { id: 'phylactery', name: 'Phylactery', note: 'a soul caught in a vessel instead of dying',
        ev: (b) => ({ kind: 'phylactery', at: b.me }) },
    ] },
  { group: 'Marvorren — sea and song',
    items: [
      { id: 'song', name: 'Song', note: 'the Singers resonate and something obeys',
        ev: (b) => ({ kind: 'song', at: b.me }) },
      { id: 'tide', name: 'Tide', note: 'a whole row swept along',
        ev: (b) => ({ kind: 'tide', at: b.me }) },
      { id: 'usher', name: 'Usher', note: 'one fighter moved a single square by another',
        ev: (b) => ({ kind: 'usher', at: b.me }) },
      { id: 'depthcharge', name: 'Depth Charge', note: 'a charge under the water in your own Back Row',
        ev: (b) => ({ kind: 'depthcharge', at: b.me }) },
      { id: 'lashout', name: 'Lash Out', note: 'something reaches out and kills at a distance',
        ev: (b) => ({ kind: 'lashout', at: b.me }) },
    ] },
  { group: 'Shardsworn — crystal',
    items: [
      { id: 'shatterblast', name: 'Shatter Blast', note: 'everything adjacent comes apart',
        ev: (b) => ({ kind: 'shatterblast', at: b.me }) },
      { id: 'bounce', name: 'Bounce', note: 'dissolved and sent back to hand',
        ev: (b) => ({ kind: 'bounce', at: b.me }) },
      { id: 'arcane', name: 'Arcane Blast', note: 'cards spent from hand become a blast',
        ev: (b) => ({ kind: 'arcane', at: b.me }) },
      { id: 'graft', name: 'Graft', note: 'crystal veins share what your fighters are',
        ev: (b) => ({ kind: 'graft', at: b.me }) },
      { id: 'stall', name: 'Stall', note: 'stopped rather than killed',
        ev: (b) => ({ kind: 'stall', at: b.me }) },
      { id: 'trapspring', name: 'Trap springs', note: 'a trap flips face up and snaps shut',
        ev: (b) => ({ kind: 'trapspring', at: b.me }) },
    ] },
  { group: 'Refractory, Auroxi and neutral',
    items: [
      // NO `reveal` ENTRY. The motif was deleted — it was bad and it did not
      // use the actual card — and R053/A045/A047 fall through to their
      // faction's generic cast flourish now. The button outlived the motif by
      // one pass and did nothing when pressed, which is worse than no button.
      { id: 'recall', name: 'Recall', note: 'something called back out of your graveyard',
        ev: (b) => ({ kind: 'recall', at: b.me }) },
      { id: 'entrance', name: 'Entranced', note: 'an enemy loses its own abilities',
        ev: (b) => ({ kind: 'entrance', at: b.me }) },
      { id: 'voidstep', name: 'Void Step', note: 'a shadow slips under the board',
        ev: (b) => ({ kind: 'voidstep', at: b.me }) },
      // Both of these want the Void on the table — open the page on a deck
      // that mentions it (The Voidbringers) or the far end of the link is a
      // cord running off into bare dirt. `me` is on square 3, the closest
      // square to the pit, so the span here is the SHORT one; tools/fxdemo
      // puts the fighter on 5 for the long run.
      { id: 'voidlink', name: 'Voidlink', note: 'the Void feeds a fighter that never moves',
        ev: (b) => ({ kind: 'voidlink', at: b.me, faction: 'Auroxi' }) },
      { id: 'echo', name: 'Echo', note: 'the same action happening a second time',
        ev: (b) => ({ kind: 'echo', at: b.me, faction: 'Auroxi' }) },
      { id: 'wander', name: 'Uninvited', note: 'an arrival beside an enemy stack',
        ev: (b) => ({ kind: 'wander', at: b.me }) },
      // Both idioms off one entry: the band and the seal take their colour
      // from the faction, so this is the Auroxi cloth and the Refractory one
      // is the same motif in the Inquisition's gold.
      { id: 'attach', name: 'Attach', note: 'a band is bound onto a fighter and stays there',
        ev: (b) => ({ kind: 'attach', at: b.me, faction: 'Auroxi' }) },
      { id: 'attach-iron', name: 'Attach — a writ', note: 'the same act in Refractory colours',
        ev: (b) => ({ kind: 'attach', at: b.me, faction: 'Refractory' }) },
      // NO `bury` HERE, and it is not an oversight: the motif is about a card
      // being put UNDER another one, and stage() below can only put a single
      // card on a square. A bench entry would show the press with nothing
      // underneath it, which is the one thing the effect must not look like.
      // tools/fxdemo/bury.js stages real stacks.
    ] },
  // The Masked's moon counts four turns beside the Stronghold and then turns
  // over. The phases take a PLAYER, not a square — the card is not on the
  // board yet — which is why they do not follow the `b.me` pattern above.
  //
  // `moonrise` and `maelstrom` are the two events on this whole bench whose
  // `at` is a SQUARE INDEX and not a card uid — see js/engine.js's
  // `ops.fx(state, 'moonrise', { at: spot })` and cards.js's
  // `ops.fx(state, 'maelstrom', { at: here })`. Handing them `b.me` here
  // handed them uid 44, which both motifs read as square 44 and painted
  // thirty-four units off the back of the board: they appeared to do nothing
  // at all. Both motifs now resolve either, and the bench sends what the
  // rules send. Both also need Charybdis ON the square — the whirlpool asks
  // the board whose it is, and a mouth with no owner treats your own
  // fighters as prey.
  { group: 'The Masked: New Moon and Charybdis',
    items: [
      { id: 'moon1', name: 'New Moon I', note: 'the first rotation, barely anything',
        ev: () => ({ kind: 'moonphase', at: 0, player: 0, phase: 1 }) },
      { id: 'moon2', name: 'New Moon II', note: 'a crescent, and a pool with glints',
        ev: () => ({ kind: 'moonphase', at: 0, player: 0, phase: 2 }) },
      { id: 'moon3', name: 'New Moon III', note: 'gibbous, and a short lane of light',
        ev: () => ({ kind: 'moonphase', at: 0, player: 0, phase: 3 }) },
      { id: 'moon4', name: 'New Moon IV', note: 'full, about to turn over',
        ev: () => ({ kind: 'moonphase', at: 0, player: 0, phase: 4 }) },
      // Square 2: player 0's Back Row, which is the only place the rules ever
      // put Charybdis. The card is placed before the effect fires there too.
      { id: 'moonrise', name: 'Charybdis rises', note: 'the moon comes down and the sea opens',
        pre: (put) => put(2, 'M046C', 0),
        ev: () => ({ kind: 'moonrise', at: 2, player: 0 }) },
      // The middle, so all four bearings have a neighbour and two of them
      // hold an enemy — the reach and the haul are told apart from the water
      // only by which cards move.
      { id: 'maelstrom', name: 'Maelstrom', note: 'a neighbour is dragged in and drowns',
        pre: (put) => put(4, 'M046C', 0),
        ev: () => ({ kind: 'maelstrom', at: 4 }) },
    ] },

  // A FRAUD, A TOW, A BRACE AND A CRASH. Two of these are built round
  // something this bench cannot do: main.js PINS every card the rules moved at
  // the square it left while it waits out the motif's declared timing.kill,
  // and it is that pinned state — not any argument — that tells the tow which
  // fighter it has hold of. stage() below runs before resync() and so cannot
  // pin anything, so here the tow goes taut on a fighter who never sets off;
  // tools/fxdemo/haul.js stages the real thing, slide included.
  //
  { group: 'A fraud, a tow, a brace and a crash',
    items: [
      // A040 Winds of the Steppe. Its motif used to be `gust`, whose dark dust
      // could not be seen at all against dark stone under ACES; it is
      // ./fx/effects/steppe.js now. The bench entry was left pointing at the
      // dead name for a pass and silently did nothing when pressed.
      { id: 'steppe', name: 'Winds of the Steppe', note: 'the wind comes down the rank',
        ev: (b) => ({ kind: 'steppe', at: b.me, faction: 'Auroxi' }) },
      // The villager is put on the middle square, where a 60-pixel card can
      // actually be looked at. ?stack=1 in tools/fxdemo/decoy.js buries it
      // under a real card, which is what the rule is for.
      { id: 'decoy', name: 'Totally Normal Villager', note: 'the disguise slips, briefly',
        pre: (put, b) => { b.villager = put(4, 'M025', 0); },
        ev: (b) => ({ kind: 'decoy', at: b.villager, faction: 'Marvorren' }) },
      // b.me is on square 3 and b.far on square 6, which is the neighbour the
      // tow reaches for when nothing on the board has been pinned.
      { id: 'haul', name: 'Mammoth Caravan', note: 'a trace goes tight and drags somebody along',
        ev: (b) => ({ kind: 'haul', at: b.me, faction: 'Auroxi' }) },
      // Both colours, because this motif is shared by an Auroxi card and a
      // Gloaming one and a band tuned against one of them and never looked at
      // in the other is half tested.
      { id: 'bulwark', name: 'Threadbearer braces', note: 'conditional strength, in Auroxi',
        ev: (b) => ({ kind: 'bulwark', at: b.me, faction: 'Auroxi' }) },
      { id: 'bulwark-gloam', name: 'Swarmseeker braces', note: 'the same brace in Gloaming',
        ev: (b) => ({ kind: 'bulwark', at: b.foe, faction: 'Gloaming' }) },
      // The Chimera is dealt in over 0.46s in a real game and the fractures
      // are timed to run for exactly that long on an EMPTY square — the best
      // beat in the motif, and one the bench cannot show, because stage()
      // places cards rather than deploying them. tools/fxdemo/arrive.js flies
      // it in for real.
      { id: 'arrive', name: 'Reckless Chimera', note: 'the flagstone splits, then it lands',
        pre: (put, b) => { b.chimera = put(4, 'C048', 0); },
        ev: (b) => ({ kind: 'arrive', at: b.chimera, faction: 'Shardsworn' }) },
    ] },
];

export function openLab(api) {
  const { state, fx, resync, anim } = api;

  /**
   * A board with something to do each effect TO.
   *
   * `extra` is the item's own staging, run BEFORE the resync so the pieces it
   * asks for exist by the time the effect reads the board. A few motifs — the
   * whirlpool most of all — look at what is standing where, and staging them
   * afterwards would have them read a board one frame out of date.
   */
  function stage(extra) {
    const put = (sq, def, own) => {
      const u = ++state.nextUid;
      state.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
      return u;
    };
    state.board = Array.from({ length: 12 }, () => []);
    const b = {
      me: put(3, 'A016', 0),
      foe: put(5, 'M027', 1),
      friend: put(1, 'A019', 0),
      other: put(7, 'M017', 1),
      far: put(6, 'A016', 1),
    };
    extra?.(put, b);
    state.active = 0;
    state.actionsLeft = 3;
    delete state.pending;
    state.queue = [];
    resync();
    return b;
  }

  const panel = document.createElement('div');
  panel.id = 'fxlab';
  panel.innerHTML = `
    <div class="fxl-head">
      <b>Effects bench</b>
      <span class="fxl-sub">dev only — click one to watch it</span>
    </div>
    <div class="fxl-speed">
      <label><input type="checkbox" id="fxl-slow"> half speed</label>
      <button id="fxl-again" type="button">replay</button>
      <button id="fxl-all" type="button">play all</button>
    </div>
    <div class="fxl-list"></div>
    <div class="fxl-now"></div>`;
  document.body.appendChild(panel);

  const list = panel.querySelector('.fxl-list');
  const now = panel.querySelector('.fxl-now');
  const slow = panel.querySelector('#fxl-slow');
  let last = null;

  // Half speed is the whole point of a bench: these run in under two seconds
  // and the interesting part is often a third of that.
  const realUpdate = anim.update.bind(anim);
  anim.update = (dt) => realUpdate(slow.checked ? dt * 0.5 : dt);

  const play = (item) => {
    last = item;
    now.textContent = `${item.name} — ${item.note}`;
    const b = stage(item.pre);
    if (item.chain) {
      item.chain.forEach((sq, i) => setTimeout(() => {
        const top = (state.board[sq] || [])[0];
        fx.play({ kind: 'shardfire', at: top ? top.uid : sq });
      }, i * 220));
    } else {
      fx.play(item.ev(b));
    }
  };

  for (const g of EFFECTS) {
    const h = document.createElement('div');
    h.className = 'fxl-group';
    h.textContent = g.group;
    list.appendChild(h);
    for (const item of g.items) {
      const btn = document.createElement('button');
      btn.className = 'fxl-item';
      btn.type = 'button';
      btn.innerHTML = `<span>${item.name}</span><i>${item.note}</i>`;
      btn.addEventListener('click', () => play(item));
      list.appendChild(btn);
    }
  }

  panel.querySelector('#fxl-again').addEventListener('click', () => last && play(last));
  panel.querySelector('#fxl-all').addEventListener('click', () => {
    const all = EFFECTS.flatMap((g) => g.items);
    all.forEach((item, i) => setTimeout(() => play(item), i * 2600));
  });
}
