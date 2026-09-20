// Preview harness for the shard motif. Used with tools/shot.js:
//   node tools/shot.js --url "game/?quick=1&seed=5&t=0.3" \
//     --eval tools/fxdemo/shard.js --out /tmp/shard.png --settle 250
//
// Query flags on --url, because shot.js has no way to pass arguments:
//   t=0.3      the ANIMATION time to photograph, in seconds. Not the same as
//              --settle: main.js clamps dt to 50ms a frame, and headless
//              SwiftShader renders at a handful of frames a second, so a
//              700ms --settle can be 150ms of animation. This harness stops
//              the animator and steps it by hand, so t is exact and repeatable.
//              --settle only has to be long enough for one frame to be drawn.
//   zoom=2.4   render the frame magnified about the blast (a camera view
//              offset, so the picture is RENDERED close rather than cropped —
//              at board scale a splinter is four pixels across).
//   n=3&gap=0.2  fire three blasts gap SECONDS apart, to check they overlap
//              well and do not wash the board out. Lay Waste chains half a
//              dozen deaths, so that is the case that matters.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
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

  const zoom = Number(q.get('zoom') || 0);
  if (zoom > 1) {
    const p = T.pieces.get(foe).group.position.clone().setY(0.9).project(T.camera);
    const W = innerWidth, H = innerHeight, w = W / zoom, h = H / zoom;
    T.camera.setViewOffset(W, H, (p.x * 0.5 + 0.5) * W - w / 2, (0.5 - p.y * 0.5) * H - h / 2, w, h);
  }

  const step = T.anim.update.bind(T.anim);
  T.anim.update = () => {};                       // the frame loop stops driving it
  const n = Number(q.get('n') || 1), gap = Number(q.get('gap') || 0.2);
  const where = [foe, me, friend];
  const fire = [];
  for (let i = 0; i < n; i++) fire.push([i * gap, where[i % where.length]]);

  const target = Number(q.get('t') || 0.3), DT = 1 / 60;
  let clock = 0, next = 0;
  while (clock < target) {
    while (next < fire.length && fire[next][0] <= clock) T.fx.play({ kind: 'shardfire', at: fire[next++][1] });
    step(DT);
    clock += DT;
  }
  return `shardfire x${n} at t=${clock.toFixed(2)}s`;
})()
