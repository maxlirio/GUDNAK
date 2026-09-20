// Preview harness for the thread motif. Used with tools/shot.js:
//   node tools/shot.js --url "game/?quick=1&seed=5&t=0.4" \
//     --eval tools/fxdemo/thread.js --out /tmp/thread.png --settle 250
//
// Query flags on --url (shot.js has no way to pass arguments):
//   t=0.4      the ANIMATION time to photograph, in seconds. Not --settle:
//              main.js clamps dt to 50ms a frame and headless SwiftShader
//              draws a handful of frames a second, so wall time and animation
//              time are wildly different. This stops the animator and steps it
//              by hand instead, so t is exact.
//   zoom=1.8   render magnified about the weaver (camera view offset). The
//              threads are 8cm wide — three pixels at board scale — so the
//              over/under of the crossings cannot be judged without it.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(4, 'A016', 0);
  const foe = put(5, 'M027', 1);
  const friend = put(1, 'A019', 0);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const zoom = Number(q.get('zoom') || 0);
  if (zoom > 1) {
    const p = T.pieces.get(me).group.position.clone().setY(0.5).project(T.camera);
    const W = innerWidth, H = innerHeight, w = W / zoom, h = H / zoom;
    T.camera.setViewOffset(W, H, (p.x * 0.5 + 0.5) * W - w / 2, (0.5 - p.y * 0.5) * H - h / 2, w, h);
  }

  const step = T.anim.update.bind(T.anim);
  T.anim.update = () => {};                       // the frame loop stops driving it
  T.fx.play(window.__FX_EVENT || { kind: 'threads', at: me });

  const target = Number(q.get('t') || 0.4), DT = 1 / 60;
  let clock = 0;
  while (clock < target) { step(DT); clock += DT; }
  return `threads at t=${clock.toFixed(2)}s`;
})()
