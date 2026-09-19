// Preview harness for the iron motifs. Used with tools/shot.js:
//   node tools/shot.js --url "game/?quick=1&seed=5" --eval tools/fxdemo/iron.js \
//     --out /tmp/iron.png --settle 500
// settle is MILLISECONDS. Take several, spread across the motif's length.
(() => {
  const T = window.__table, st = T.state;
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'A016', 0);
  const foe = put(5, 'M027', 1);
  const friend = put(1, 'A019', 0);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();
  const FX = (window.__FX_EVENT) || { kind: 'chains', from: friend, to: foe };
  T.fx.play(FX);
  return 'played ' + JSON.stringify(FX);
})()
