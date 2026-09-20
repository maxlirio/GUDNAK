// Preview harness for ONE effect: fire.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&fxt=2000" \
//     --eval tools/fxdemo/fire.js --out /tmp/fire-2000.png --settle 2500
//
// The cloth runs 1950ms, the burn starts at 1190ms and the last coal is out at
// about 3200ms, so take a SPREAD — 1250, 1500, 1900, 2200, 2700, 3000 — and
// look at every one of them.
//
// THE FRAME RATE TRAP, and why the shot is aimed with `fxt` and not --settle.
// main.js advances the animator with `Math.min(clock.getDelta(), 0.05)`, a
// floor of 20fps so a stalled tab cannot teleport the cards. Headless
// SwiftShader renders this forest at about three frames a second, so the
// animator was being fed 0.05s per 330ms of wall clock: at --settle 1300 the
// motif had played barely 200ms and the board came back looking untouched.
// Two ways out, both here:
//
//   ?fxt=2000   run exactly 2000ms of animation in ONE tick and then freeze,
//               so the shot is that instant and nothing else. Use this: the
//               frame is exact and repeatable, and --settle then only has to
//               be long enough for Chrome to draw (500ms is not always —
//               2500 is safe on a loaded machine).
//   (no fxt)    feed the animator real wall-clock time in 1/60 sub-steps, so
//               --settle means roughly what it says even at three frames a
//               second. Only roughly: capturing forces one more frame, so the
//               picture lands a few hundred ms LATER than --settle says.
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

  const anim = T.anim;
  const step = anim.update.bind(anim);
  // Sub-steps of 1/60 rather than one big jump: the cloth integrates itself
  // with Verlet and a single 2-second step would fling it off the table.
  const fxt = Number(new URLSearchParams(location.search).get('fxt') || 0) / 1000;
  if (fxt > 0) {
    let spent = 0;
    anim.update = () => {
      while (spent < fxt) { const s = Math.min(1 / 60, fxt - spent); step(s); spent += s; }
    };
  } else {
    let last = performance.now();
    anim.update = () => {
      let dt = Math.min(1.0, (performance.now() - last) / 1000);
      last = performance.now();
      while (dt > 1e-4) { const s = Math.min(1 / 60, dt); step(s); dt -= s; }
    };
  }

  // The table plays on the moment the animator falls idle, and at a frozen
  // ?fxt= that happens inside the first tick — the next actions then dropped
  // their own effects into the shot. One tween that never ends keeps the
  // table busy, so the only thing moving is the bolt.
  anim.add(999, () => {});

  const ev = { kind: 'bolt', bolt: 'fire', from: me, to: foe };
  T.fx.play(ev);
  return 'played ' + JSON.stringify(ev) + (fxt ? ` frozen at ${fxt}s` : '');
})()
