// THE STUNT DOUBLE — proof that the card on screen and the card in the state
// have been separated.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&zoom=22&t=140" \
//     --eval tools/fxdemo/stuntdouble.js --out /tmp/sd.png --wait 10000 --settle 400
//
//   &t=140    freeze the animation 140ms in. Wall-clock --settle is useless
//             here: headless Chrome renders this scene at about six frames a
//             second, so the animator is driven by hand instead.
//   &what=move | deploy      which animation to put under the microscope
//   &zoom=22  field of view
//
// The two symptoms this is here to catch, both of them reported from a real
// game:
//
//   1. "put the wrong guy on top" — a card going UNDER a stack used to fly to
//      the bare middle of the square at the top card's height and only crawl
//      down to its real depth after the animation let go. For the length of
//      the arc the wrong card was on top.
//   2. "the chains went after the card was moved under" — an effect that fires
//      once the rules have resolved asked a card that was still in mid-air
//      where it was, and was told about the flight instead of about the board.
//
// The returned object is the evidence: `hidden` says the real card is behind a
// double, `offBy` is how far the real card is from where its square and depth
// say it belongs (it must be 0 on EVERY frame of the animation), and `fxSees`
// is what an effect asking kit.at() for that card is told.
(() => {
  const T = window.__table, st = T.state;
  if (!T || !st) return 'no table yet';
  const q = new URLSearchParams(location.search);
  const freeze = q.has('t') ? Number(q.get('t')) / 1000 : 0;
  const what = q.get('what') || 'move';

  if (q.has('zoom')) {
    T.camera.fov = Number(q.get('zoom'));
    T.camera.updateProjectionMatrix();
  }

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq].push({ uid: u, def, owner: own, fatigued: false, attachments: [] });
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];

  // Square 3 already has two cards on it; the third is going UNDERNEATH both.
  const top = put(3, 'A016', 0);
  put(3, 'M017', 0);
  const mover = put(5, 'M027', 1);
  T.resync();                       // every card born on its own square

  // Now the rules resolve — instantly and completely, as they always do. The
  // newcomer is at the BOTTOM of the stack from this moment on.
  const card = st.board[5][0];
  st.board[3] = [...st.board[3], card];
  st.board[5] = [];
  T.resync();

  const piece = T.pieces.get(mover);

  // &twin=1 — the REAL card on square 3 and nothing but its stand-in on square
  // 5, side by side in one frame and the same distance from the same lights.
  // If the two are not the same picture the swap is visible and the whole
  // trick is off. A card at -I is used, because the counter is the part of a
  // card most easily left behind by a copy.
  if (q.has('twin')) {
    st.board = Array.from({ length: 12 }, () => []);
    const a = put(3, 'M027', 0);
    const b = put(5, 'M027', 0);
    T.resync();
    for (const u of [a, b]) T.pieces.get(u).setMarkers({ powerDelta: -1, tokens: ['bleed'] });
    const p = T.pieces.get(b);
    for (let i = 0; i < 30; i++) p.update(0.05, T.camera);   // settle the easing
    const d = p.makeProxy();
    T.arena.scene.add(d.group);
    p.group.visible = false;
    T.anim.update = () => {};
    return 'left card is real, right card is its stunt double';
  }

  if (what === 'deploy') T.anim.deploy(piece, 3, undefined, null);
  else T.anim.move(piece, 5, 3);

  // Step to the wanted moment and take the animator's clock away, so the
  // render loop cannot creep past it while the screenshot is being taken.
  const STEP = 1 / 120;
  const worst = { offBy: 0, at: 0 };
  for (let c = 0; c < freeze; c += STEP) {
    T.anim.update(STEP);
    const off = piece.group.position.distanceTo(piece.restingPosition());
    if (off > worst.offBy) { worst.offBy = off; worst.at = c; }
  }
  T.anim.update = () => {};

  const truth = piece.restingPosition();
  const seen = T.fx.kit.at(mover);
  return {
    what,
    frozenAt: freeze,
    depth: piece.depth,
    topOfStack: T.pieces.get(top).depth,
    hidden: piece.group.visible === false,
    doubles: piece.doubles || 0,
    // zero on every frame, or the board was lying while the card was in flight
    offBy: Number(worst.offBy.toFixed(6)),
    worstFrameAt: Number(worst.at.toFixed(3)),
    // what an effect firing right now is told about this card
    fxSees: seen ? [+seen.x.toFixed(3), +seen.y.toFixed(3), +seen.z.toFixed(3)] : null,
    truth: [+truth.x.toFixed(3), +truth.y.toFixed(3), +truth.z.toFixed(3)],
  };
})()
