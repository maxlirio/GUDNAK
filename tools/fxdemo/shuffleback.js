// SHUFFLED BACK INTO THE DECK — Migration (A038) putting itself away.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=430" \
//     --eval tools/fxdemo/shuffleback.js --out /tmp/sb.png --wait 10000 --settle 400
//
//   &t=430    freeze the animation 430ms in. Wall clock is useless here —
//             headless Chrome renders this scene at about six frames a second.
//   &zoom=24  field of view
//
// This is played through the REAL path, not staged: the Tactic is put in hand,
// the legal action is taken, the square is chosen, and the state diff in
// main.js is what has to notice that a card went from the hand to the DECK.
// Before this existed the card simply vanished out of the hand and the deck
// silently grew by one.
(() => {
  const T = window.__table, st = T.state;
  if (!T || !st) return 'no table yet';
  const q = new URLSearchParams(location.search);
  const freeze = q.has('t') ? Number(q.get('t')) / 1000 : 0;

  if (q.has('zoom')) {
    T.camera.fov = Number(q.get('zoom'));
    T.camera.updateProjectionMatrix();
  }

  // Migration into the active player's hand, by renaming a card they already
  // hold — which keeps the engine's own card object and its uid.
  st.active = 0;
  st.actionsLeft = 3;
  delete st.pending;
  st.queue = [];
  const card = st.players[0].hand[0];
  card.def = 'A038';
  T.resync();

  const deckWas = st.players[0].deck.length;
  const act = T.legal().find((a) => a.t === 'tactic' && a.card === card.uid);
  if (!act) return 'Migration is not playable here';
  T.play(act);

  // "Your Gates are now where?" — answer it, and the Tactic retires into the
  // deck. That second submit is the one the animation has to come off.
  const req = st.pending && st.pending.request;
  if (req) T.choose(req.options[0]);

  const STEP = 1 / 120;
  for (let c = 0; c < freeze; c += STEP) T.anim.update(STEP);
  if (freeze) T.anim.update = () => {};

  return {
    frozenAt: freeze,
    deckWas,
    deckNow: st.players[0].deck.length,
    inDeck: st.players[0].deck.some((c) => c.uid === card.uid),
    inGrave: st.players[0].graveyard.some((c) => c.uid === card.uid),
    running: T.anim.running.length,
  };
})()
