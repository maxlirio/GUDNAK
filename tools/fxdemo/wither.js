// Preview harness for ONE motif: wither.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/wither.js --out /tmp/wither-300.png --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// Both cards that use this motif are TACTICS, and a tactic is not always a
// piece on the board: Funeral Pyre lands as a Construct but Fratricide never
// has a card of its own, so `kit.at` falls through to a bare square and
// `kit.piece` answers null. Two extra cases cover that, because the motif
// greys a card and sags it and all of that has to be optional:
//
//   &on=bare    play it on an empty square — no piece to grey, no card to sag
//   &on=stack   play it on the top of a three-deep stack
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'A016', 0);        // your fighter, centre-left
  const foe = put(5, 'M027', 1);       // an enemy, centre-right
  const friend = put(1, 'A019', 0);    // a second fighter of yours
  const on = q.get('on') || '';
  if (on === 'stack') {
    st.board[3] = [
      { uid: me, def: 'A016', owner: 0, fatigued: false, attachments: [] },
      { uid: ++st.nextUid, def: 'A019', owner: 0, fatigued: false, attachments: [] },
      { uid: ++st.nextUid, def: 'M027', owner: 1, fatigued: false, attachments: [] },
    ];
  }
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  // square 8 is empty in every layout above, so this is the no-piece path
  T.fx.play({ kind: 'wither', at: on === 'bare' ? 8 : me, faction: 'Gloaming' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played wither frozen at ' + at.toFixed(2) + 's';
})()
