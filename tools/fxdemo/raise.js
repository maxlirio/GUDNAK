// Preview harness for ONE motif: raise.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/raise.js --out /tmp/raise-300.png --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// Two more switches, for the two ways this motif is asked for:
//   ?bare=1   fire it on an EMPTY square, the way a Necromancer deploying into
//             open ground does — the flat parts have to drop to the flagstone
//             face at 0.080 instead of riding a card at 0.21
//   ?many=1   fire it on three squares in one breath, the way The Living Dead
//             does, to see whether three graves opening at once read as three
//             different graves or as the same texture stamped three times
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
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  if (q.get('bare')) {
    T.fx.play({ kind: 'raise', at: 8, faction: 'Gloaming' });
  } else if (q.get('many')) {
    for (const who of [me, friend, foe]) {
      T.fx.play({ kind: 'raise', at: who, faction: 'Gloaming' });
    }
  } else {
    T.fx.play({ kind: 'raise', at: me, faction: 'Gloaming' });
  }
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played raise frozen at ' + at.toFixed(2) + 's';
})()
