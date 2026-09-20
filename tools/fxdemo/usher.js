// Preview harness for ONE motif: usher.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/usher.js --out /tmp/usher-300.png \\
//     --wait 4000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and
// past about a second it deals over the board this sets up.
//
// ?me is the square the motif fires on, 0..8, so the other three directions
// the lane can take can be looked at: the motif steps toward the camera where
// it can, so ?me=1 (front row) forces the sideways one.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const home = Math.max(0, Math.min(8, Number(q.get('me') ?? 3)));
  const me = put(home, 'A016', 0);     // the fighter the motif fires on
  put(home === 5 ? 8 : 5, 'M027', 1);  // an enemy, kept off the motif's square
  put(home === 1 ? 7 : 1, 'A019', 0);  // a second fighter of yours
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  T.fx.play({ kind: 'usher', at: me, faction: 'Marvorren' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played usher on square ' + home + ' frozen at ' + at.toFixed(2) + 's';
})()
