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
      { id: 'reveal', name: 'Reveal', note: 'a card hauled off a deck to be judged',
        ev: (b) => ({ kind: 'reveal', at: b.me }) },
      { id: 'recall', name: 'Recall', note: 'something called back out of your graveyard',
        ev: (b) => ({ kind: 'recall', at: b.me }) },
      { id: 'entrance', name: 'Entranced', note: 'an enemy loses its own abilities',
        ev: (b) => ({ kind: 'entrance', at: b.me }) },
      { id: 'voidstep', name: 'Void Step', note: 'a shadow slips under the board',
        ev: (b) => ({ kind: 'voidstep', at: b.me }) },
      { id: 'wander', name: 'Uninvited', note: 'an arrival beside an enemy stack',
        ev: (b) => ({ kind: 'wander', at: b.me }) },
    ] },
];

export function openLab(api) {
  const { state, fx, resync, anim } = api;

  /** A board with something to do each effect TO. */
  function stage() {
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
    const b = stage();
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
