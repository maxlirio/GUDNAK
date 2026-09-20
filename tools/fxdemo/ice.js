// Preview harness for ONE effect: ice.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=1300" \
//     --eval tools/fxdemo/ice.js --out /tmp/ice-1300.png --settle 900
//
// `t` in the URL is the moment IN THE MOTIF, in ms — not --settle. The frame
// loop clamps dt to 0.05s, so on a loaded machine a browser frame advances the
// animation by 50ms however long it really took: wall-clock --settle then bears
// no relation to where the cloth is, and every early picture of this effect
// came back as an empty table. So the animator is stepped by hand to exactly
// `t` and then frozen, and --settle only has to be long enough for one frame to
// be drawn. This motif runs for roughly 1900ms and the freeze starts near
// 1190ms, so take a SPREAD of shots across that and look at each one.
// This file is yours to change while you work on that effect.
(() => {
  const T = window.__table, st = T.state, anim = T.anim;
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
  const ev = { kind: 'bolt', bolt: 'ice', from: me, to: foe };
  T.fx.play(ev);

  const at = Number(new URLSearchParams(location.search).get('t') || 1300) / 1000;
  const STEP = 1 / 60;
  for (let s = 0; s < at; s += STEP) anim.update(STEP);
  anim.update = () => {};              // hold this instant for the camera
  return 'played ' + JSON.stringify(ev) + ' @' + at + 's';
})()
