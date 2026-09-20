// Preview harness for ONE effect: lightning.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=1200" \
//     --eval tools/fxdemo/lightning.js --out /tmp/lightning-1200.png --settle 250
//
// `t` in the URL is the moment in ANIMATION time (ms) to photograph, and it is
// not the same thing as --settle. Headless swiftshader renders this scene at
// under 3fps, and the frame loop clamps dt to 0.05s, so animation time crawls
// along at about a seventh of wall-clock: a --settle of 1200ms was landing at
// roughly 170ms into a 1950ms motif and every shot came back with an empty
// board. So the animator is unhooked from the frame loop here, stepped by hand
// in fixed 1/120s slices to exactly `t`, and then frozen — which also makes the
// shots repeatable while other agents are loading the machine.
//
// This motif runs for roughly 1950ms and the lightning's own part starts at
// about 1190ms. This file is yours to change while you work on that effect.
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
  anim.update = () => {};              // the frame loop no longer drives it

  const ev = { kind: 'bolt', bolt: 'lightning', from: me, to: me, toSquare: 8 };
  T.fx.play(ev);

  // The GAME moves the card, not the effect; it is done here at the moment the
  // fighter is meant to be gone so the arrival is judged against a card that is
  // actually there, rather than against an empty square.
  const MOVE = 1.46;
  const target = Number(new URLSearchParams(location.search).get('t') || 1200) / 1000;
  const h = 1 / 120;
  let moved = false;
  for (let e = 0; e < target; e += h) {
    step(Math.min(h, target - e));
    if (!moved && e >= MOVE) {
      moved = true;
      st.board[8] = st.board[3]; st.board[3] = [];
      T.resync();
      const p = T.pieces?.get(me);
      if (p) { p.group.position.x = 2.62; p.group.position.z = -2.62; }
    }
  }
  // where to crop: the camera drifts between runs, so the pixel coordinates of
  // the two squares are reported from the SAME run as the picture
  const px = (sq) => {
    const v = T.fx.kit.at(sq).clone().project(T.camera);
    return `${sq}@${Math.round((v.x * 0.5 + 0.5) * innerWidth)},${Math.round((-v.y * 0.5 + 0.5) * innerHeight)}`;
  };
  console.log('SQ', px(3), px(8));
  return `t=${target}s`;
})()
