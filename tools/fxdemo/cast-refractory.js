// Preview harness for ONE effect: cast-refractory.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&at=200" \
//     --eval tools/fxdemo/cast-refractory.js --out /tmp/cr-200.png --settle 250
//
// ?at is MILLISECONDS INTO THE MOTIF, not wall clock, and it is the only
// honest way to look at this. Headless Chrome on SwiftShader renders this
// table at four or five frames a second, and main.js clamps dt to 0.05, so a
// --settle of 130ms and one of 60ms came back as the SAME picture: barely one
// step of animation either way. So the harness freezes the animator, plays the
// event, and then steps it by hand in 1/60s slices to exactly ?at.
//
// ?fov=20 narrows the camera onto the board for a close look at the motif —
// the real game runs at 40, so judge the final thing at 40 and use this only
// to check detail. ?sq=6 fires it on a different square.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const sq = Number(q.get('sq') ?? 3);
  const me = put(sq, 'A016', 0);       // the card that resolves
  put(5, 'M027', 1);                   // an enemy, to judge the motif against
  put(1, 'A019', 0);                   // a second card of yours
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  if (q.has('fov')) { T.camera.fov = Number(q.get('fov')); T.camera.updateProjectionMatrix(); }

  const ev = { kind: 'cast', at: me, faction: 'Refractory' };
  if (!q.has('at')) { T.fx.play(ev); return 'played live ' + JSON.stringify(ev); }

  // Freeze, play, step. The render loop keeps drawing, so the frozen state is
  // what the screenshot catches.
  //
  // The wait is not politeness: the card JPEGs only start loading when resync
  // builds the pieces, and a third of the shots came back with the card drawn
  // BLACK because the picture was still in flight. shot.js awaits a returned
  // promise, so the whole thing hangs off one.
  return new Promise((done) => setTimeout(() => {
    const anim = T.anim;
    const step = anim.update.bind(anim);
    anim.update = () => {};
    T.fx.play(ev);
    const at = Number(q.get('at')) / 1000;
    for (let s = 0; s < at; s += 1 / 60) step(Math.min(1 / 60, at - s));
    done(`stepped to ${q.get('at')}ms`);
  }, 1500));
})()
