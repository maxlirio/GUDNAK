// Preview harness for ONE effect: shadow.
//
//   node tools/shot.js --url "game/?quick=1&seed=5" \
//     --eval tools/fxdemo/shadow.js --out /tmp/shadow-400.png --settle 400
//
// --settle is MILLISECONDS after the effect is triggered. This motif runs for
// roughly 1900ms, so take a SPREAD of shots across it and look at each one.
// This file is yours to change while you work on that effect.
(() => {
  const T = window.__table, st = T.state;
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
  const ev = { kind: 'bolt', bolt: 'shadow', from: me, to: foe };
  T.fx.play(ev);
  return 'played ' + JSON.stringify(ev);
})()
