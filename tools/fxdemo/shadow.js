// Preview harness for ONE effect: shadow.
//
//   node tools/shot.js --url "game/?quick=1&seed=5#t=1300" \
//     --eval tools/fxdemo/shadow.js --out /tmp/shadow-1300.png --settle 60
//
// The time to show is the `#t=<ms>` on the URL, NOT --settle. On this machine
// WebGL falls back to SwiftShader and the render loop is starved to one or two
// frames a second, so waiting in wall-clock time showed the motif frozen at
// its first frame every time. The animator is stepped by hand here instead, at
// a fixed 60Hz, so the picture is of the moment asked for.
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

  const ms = Number((location.hash.match(/t=(\d+)/) || [])[1] || 1300);
  const step = 1 / 60;
  for (let s = 0; s < ms / 1000; s += step) T.anim.update(step);
  return 'played ' + JSON.stringify(ev) + ' @ ' + ms + 'ms';
})()
