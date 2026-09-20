// Preview harness for ONE effect: thread.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&fxt=0.45" \
//     --eval tools/fxdemo/thread.js --out /tmp/thread.png --settle 200
//
// `fxt` is the moment IN THE MOTIF, in seconds, and it is the flag to use.
// --settle is wall-clock milliseconds, and wall clock is useless here: under
// headless SwiftShader the table renders at two or three frames a second, and
// main.js clamps dt to 0.05, so a 2-second motif takes something like fifteen
// wall seconds and every shot in a "spread" lands in the first frames of it.
// That is why the first pass at this looked frozen. With `fxt` the harness
// pumps the animator by hand to the moment asked for and then stops it dead,
// so the picture is exactly that moment.
//
// The motif runs 2.05s: lead 0-0.30, hem 0.24-0.68, guys 0.26-0.72,
// warp 0.40-0.83, weft (the shuttle) 0.66-1.24, the pull at 1.28, down and
// settled by 1.58, fading from 1.72, gone at 2.05.
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
  const ev = { kind: 'threads', at: me };
  T.fx.play(ev);

  const fxt = Number(new URLSearchParams(location.search).get('fxt') || 0);
  if (fxt > 0) {
    const step = 1 / 60;
    for (let t = 0; t < fxt; t += step) T.anim.update(step);
    T.anim.update = () => {};          // hold the motif still for the camera
  }
  return 'played ' + JSON.stringify(ev) + ' @t=' + fxt;
})()
