// Preview harness for WITHER'S EXIT — what becomes of the cards it kills.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=900" \
//     --eval tools/fxdemo/witherexit.js --out /tmp/we-900.png --settle 900
//
// ?t is MILLISECONDS FROM THE MOMENT THE SPELL RESOLVES, not from the moment
// the victim starts rotting: the exit runs fx.killWait() seconds later, and
// the whole point of the pair is that they read as one event, so this runs
// them on the same clock main.js does.
//
// Funeral Pyre kills THREE friendly Is and then an enemy, so the default here
// is four cards leaving at once — one card looking right proves nothing about
// four of them overlapping. &one=1 isolates a single victim.
//
// &self=1 hands the SOURCE card to the exit as well. Funeral Pyre resolves as
// a Construct, so the card the motif is playing on can be one of the cards
// that leaves, and the motif and the exit then run on the same piece — which
// is the case the hand-over in wither.js exists for.
//
// --settle is WALL CLOCK and headless rendering runs animation time at a
// fraction of it, so the animator is taken off the frame clock and stepped by
// hand to ?t, then frozen; --settle then only has to be long enough for
// Chrome to draw one frame.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const one = q.get('one') === '1';
  // the card that resolved, and the fighters it takes with it
  const source = put(4, 'A016', 0);
  const victims = one
    ? [[3, put(3, 'A019', 0)]]
    : [[3, put(3, 'A019', 0)], [0, put(0, 'A016', 0)],
      [5, put(5, 'M027', 1)], [7, put(7, 'A019', 1)]];
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};

  const ev = { kind: 'wither', at: source, faction: 'Gloaming' };
  T.fx.play(ev);
  // exactly what main.js does: wait the motif's own kill time, then hand each
  // dying card to whoever owns its leaving
  const wait = T.fx.killWait([ev]);
  const leave = T.fx.exitFor([ev], 'destroy');
  const leaving = q.get('self') === '1' ? [...victims, [4, source]] : victims;
  const pieces = leaving.map(([sq, uid]) => [sq, uid, T.pieces.get(uid)]);
  T.anim.add(wait, () => {}, () => {
    for (const [sq, uid, piece] of pieces) leave(piece, sq, () => T.pieces.retire(uid));
  });

  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return `wither + exit x${pieces.length}, kill wait ${wait}s, frozen at ${at.toFixed(2)}s`;
})()
