// Preview harness for the faction motifs. Used with tools/shot.js:
//   node tools/shot.js --url "game/?quick=1&seed=5&fx=Gloaming" \
//     --eval tools/fxdemo/faction.js --out /tmp/faction.png --settle 500
// settle is MILLISECONDS. Take several, spread across the motif's length.
//
// ?fx= picks what to fire, so a spread of shots needs no edit between runs:
//   a faction name   one cast on the middle square
//   all              all five at once, on separate squares, to compare them
//   volley           the Refractory Barrage, one fighter into three enemies
(() => {
  const T = window.__table, st = T.state;
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // Past 11, because kit.at() resolves a ref as a UID first and only falls back
  // to a square index — with uids 1..4 a target square of 1 picked up whichever
  // card happened to hold that uid and the shot went nowhere.
  st.nextUid = 100;
  const me = put(4, 'A016', 0);
  put(5, 'M027', 1);
  put(1, 'A019', 1);
  put(7, 'M027', 1);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const q = new URLSearchParams(location.search);
  // The board is a small island in a 1280x800 frame, so detail work needs a
  // narrower lens. The frame loop re-places the camera every tick but never
  // touches the fov, so this sticks.
  const fov = Number(q.get('fov') || 0);
  if (fov) { T.camera.fov = fov; T.camera.updateProjectionMatrix(); }

  const want = q.get('fx') || 'Refractory';
  let fired;
  if (want === 'all') {
    // Spread over the board so no two overlap: the point of this shot is
    // whether they are telling apart at a glance, not whether they look busy.
    const each = [['Auroxi', 0], ['Refractory', 2], ['Gloaming', 6],
      ['Shardsworn', 8], ['Marvorren', 4]];
    for (const [faction, sq] of each) T.fx.play({ kind: 'cast', at: sq, faction });
    fired = 'all five';
  } else if (want === 'volley') {
    T.fx.play({ kind: 'volley', from: me, targets: [5, 1, 7] });
    fired = 'volley';
  } else {
    T.fx.play({ kind: 'cast', at: 4, faction: want });
    fired = want;
  }

  // ?at=400 means "400ms INTO the effect", not 400ms of wall clock.
  //
  // Headless Chrome on SwiftShader draws this scene at a handful of frames a
  // second, and main.js clamps dt to 0.05, so animation time crawls at about a
  // third of real time — --settle 300 was landing at 100ms of motif and every
  // early shot looked like nothing had happened yet. Pumping the animator by
  // hand and then stopping it dead gives the exact frame asked for.
  const at = Number(q.get('at') || 0);
  if (at > 0) {
    let left = at / 1000;
    while (left > 1e-6) { const d = Math.min(1 / 120, left); T.anim.update(d); left -= d; }
    T.anim.update = () => {};
  }
  return `played ${fired}${at ? ` at ${at}ms` : ''}`;
})()
