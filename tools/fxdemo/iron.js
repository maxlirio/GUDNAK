// Preview harness for the iron motifs. Used with tools/shot.js:
//   node tools/shot.js --url "game/?quick=1&seed=5&fx=chains&t=600&zoom=22" \
//     --eval tools/fxdemo/iron.js --out /tmp/iron.png --settle 200
//
// Query flags, so a whole spread can be shot without editing this file:
//   fx=chains | brand | sweep   (sweep = a Man Catcher taking a whole stack)
//   t=<ms>                      WHERE IN THE MOTIF to freeze, not wall clock
//   zoom=<fov>                  narrows the lens; the board is small at 40
//
// `t` exists because headless Chrome renders this scene at about six frames a
// second on SwiftShader, so --settle 800 was really showing the motif 80ms in
// and every early screenshot of the drag showed a card that had not moved. The
// animator is stepped by hand to the wanted moment and then frozen, so the
// picture is of a known frame of the effect.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq].push({ uid: u, def, owner: own, fatigued: false, attachments: [] });
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const which = q.get('fx') || 'chains';

  if (q.get('zoom')) { T.camera.fov = Number(q.get('zoom')); T.camera.updateProjectionMatrix(); }
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];

  const runTo = () => {
    const target = Number(q.get('t') || 0) / 1000;
    const step = 1 / 90;
    for (let s = 0; s < target; s += step) T.anim.update(step);
    T.anim.update = () => {};   // frozen, so waiting for the shot cannot move it
  };

  if (which === 'brand') {
    const foe = put(2, 'M027', 1);
    put(1, 'A016', 0);
    T.resync();
    T.fx.play({ kind: 'brand', target: foe });
    runTo();
    return 'brand';
  }

  // Chains: the rules have ALREADY dragged the victim under the captor by the
  // time the effect plays, so stage it the same way — draw the board with the
  // victim still out there, then move it in state and play the effect in the
  // same tick, which is what sync() does.
  const captor = put(2, 'A044', 0);   // square 2, not 1: a Gates square has a
  const victims = which === 'sweep'
    ? [put(1, 'M027', 1), put(1, 'M021', 1), put(1, 'M014', 1)]   // rail and posts standing
    : [put(1, 'M027', 1)];                                        // where the chain lands
  T.resync();

  const taken = st.board[1];
  st.board[1] = [];
  st.board[2] = [...st.board[2], ...taken];       // under the captor, in order
  T.resync();
  for (const v of victims) T.fx.play({ kind: 'chains', from: captor, to: v });
  runTo();
  return which;
})()
