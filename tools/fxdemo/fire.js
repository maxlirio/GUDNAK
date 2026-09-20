// Preview harness for ONE effect: fire.
//
//   node tools/shot.js --url "game/?quick=1&seed=5" \
//     --eval tools/fxdemo/fire.js --out /tmp/fire-1300.png --settle 1300
//
// --settle is MILLISECONDS after the effect is triggered. This motif runs for
// roughly 1900ms and the burn starts at about 1190ms, so take a SPREAD of
// shots across it and look at each one.
//
// THE FRAME RATE TRAP. main.js advances the animator with
// `Math.min(clock.getDelta(), 0.05)` — a floor of 20fps so a stalled tab does
// not teleport the cards. Headless SwiftShader renders this forest at about
// three frames a second, so the animator was being fed 0.05s per 330ms of wall
// clock and every early --settle came back as an empty, untouched board: at
// --settle 1300 the motif had played barely 200ms. Two ways out, both here:
//
//   ?fxt=1300   run exactly 1300ms of animation in ONE tick and then freeze,
//               so the shot is that instant and nothing else — this is what to
//               use while working, because the frame is repeatable.
//   (no fxt)    feed the animator real wall-clock time in 1/60 sub-steps, so
//               --settle means what it says even at three frames a second.
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
  const fxt = Number(new URLSearchParams(location.search).get('fxt') || 0) / 1000;
  if (fxt > 0) {
    let spent = 0;
    anim.update = () => {
      if (spent >= fxt) return;
      while (spent < fxt) { const s = Math.min(1 / 60, fxt - spent); step(s); spent += s; }
      console.log('DBG spent', spent.toFixed(3), 'tweens', anim.running.length,
        anim.running.map((w) => w.life.toFixed(2) + '/' + w.span.toFixed(2)).join(' '));
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
