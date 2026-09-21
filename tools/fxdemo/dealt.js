// A card dealt out of the hand, and a card thrown on the discard pile, both
// through the real path and both now flown by a stunt double.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=200" \
//     --eval tools/fxdemo/dealt.js --out /tmp/dealt.png --wait 10000 --settle 400
//
//   &t=200    freeze the animation 200ms in
//   &what=discard   pay a Defend out of hand instead of deploying
(() => {
  const T = window.__table, st = T.state;
  if (!T || !st) return 'no table yet';
  const q = new URLSearchParams(location.search);
  const freeze = q.has('t') ? Number(q.get('t')) / 1000 : 0;
  const what = q.get('what') || 'deploy';

  if (q.has('zoom')) {
    T.camera.fov = Number(q.get('zoom'));
    T.camera.updateProjectionMatrix();
  }

  let act;
  if (what === 'discard') {
    // An enemy standing in your Gates, so Defend is legal and its cost comes
    // out of the hand — which is the only route to discardFromHand.
    st.board = Array.from({ length: 12 }, () => []);
    st.board[1].push({ uid: ++st.nextUid, def: 'M027', owner: 1, fatigued: false, attachments: [] });
    st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
    T.resync();
    act = T.legal().find((a) => a.t === 'defend');
  } else {
    act = T.legal().find((a) => a.t === 'deploy');
  }
  if (!act) return `no ${what} available`;
  T.play(act);
  // A Defend's cost is a `some` request and wants an ARRAY back; answering it
  // with a bare option leaves the prompt open and nothing animates at all.
  let guard = 0;
  while (st.pending && guard++ < 20) {
    const req = st.pending.request;
    const opts = req.options || [];
    if (req.type === 'some') T.choose(opts.slice(0, req.count));
    else if (req.type === 'confirm') T.choose(true);
    else if (opts.length) T.choose(opts[0]);
    else break;
  }

  const STEP = 1 / 120;
  for (let c = 0; c < freeze; c += STEP) T.anim.update(STEP);
  if (freeze) T.anim.update = () => {};
  return { what, action: act.t, frozenAt: freeze, running: T.anim.running.length };
})()
