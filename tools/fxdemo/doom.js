// Preview harness for ONE effect: doom.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&at=1200" \
//     --eval tools/fxdemo/doom.js --out /tmp/doom.png --settle 2500
//
// `at` in the URL is MILLISECONDS INTO THE MOTIF, not wall clock. Headless
// Chrome on SwiftShader renders at a handful of frames a second and main.js
// clamps dt to 0.05, so a wall-clock --settle of 1200ms was only advancing the
// animation by about 200ms — every early shot came back as an untouched board
// and looked like the effect was broken. So the animator is stepped by hand at
// a steady 1/60 here and then FROZEN, and the screenshot is of that exact
// instant however slowly the page is drawing.
(() => {
  const T = window.__table, st = T.state;
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // The doom bolt kills its CARRIER and every neighbour that shares a trait, so
  // the carrier stands in the centre with a fighter on each orthogonal square:
  // the blast has to read as reaching THEM, not as a light show on bare stone.
  const me = put(4, 'A016', 0);
  put(1, 'A019', 0);
  put(3, 'A019', 0);
  put(5, 'M027', 1);
  put(7, 'M027', 1);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(new URLSearchParams(location.search).get('at') || 1200) / 1000;
  const anim = T.anim;
  const step = anim.update.bind(anim);
  anim.update = () => {};                 // the rAF loop no longer drives it

  const ev = { kind: 'bolt', bolt: 'doom', from: me, to: me };
  T.fx.play(ev);
  const DT = 1 / 60;
  for (let s = 0; s < at; s += DT) step(DT);
  return 'played at ' + at.toFixed(3) + 's';
})()
