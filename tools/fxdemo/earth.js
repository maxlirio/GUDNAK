// Preview harness for ONE effect: earth.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&ft=1300" \
//     --eval tools/fxdemo/earth.js --out /tmp/earth-1300.png --settle 500
//
// `ft` is the moment to photograph, in MILLISECONDS OF ANIMATION TIME, and it
// is the number that matters — --settle is only "give the page long enough to
// draw one frame".
//
// Why not just use --settle? main.js clamps the frame delta to 0.05s, so on a
// software renderer running at five frames a second the animator advances at a
// quarter of wall-clock speed and --settle 1300 photographs the motif at about
// 300ms. Every early shot of this effect came back as an empty table for that
// reason. So the harness freezes the animator, steps it by hand to exactly the
// requested time, and lets the page carry on rendering that frozen frame.
//
// `dst` picks the square they are shoved to: 8 is straight away from the
// camera (the shove foreshortens), 4 is across the screen. Both need looking
// at, because the push direction is the whole point of this ending. `dst=99`
// is not a square at all, which is how to see the blocked case — the bolt has
// them but there is nowhere to put them.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
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

  const dest = Number(q.get('dst') ?? 8);
  const ev = { kind: 'bolt', bolt: 'earth', from: me, to: foe, toSquare: dest };
  // `mv=1` slides the victim's card the way the real game does. main.js starts
  // that move a second BEFORE the cloth grips, so the far square is occupied
  // and the near one empty by the time this ending runs — which is the case
  // the effect actually has to look right in, and not what a static board
  // shows. Both are worth a shot: without it you can see what the near square
  // looks like when something is still standing on it.
  //
  // The card's RESTING place comes from the board, and pieces.js lerps it back
  // there the moment the move tween lets go — so calling anim.move on its own
  // just snapped the card home again. The square has to change too.
  if (q.get('mv')) {
    const piece = T.pieces.get(foe);
    const home = piece.group.position.clone();
    st.board[dest] = st.board[5]; st.board[5] = [];
    T.resync();
    piece.group.position.copy(home);    // fx.play reads this, and it is behind
    T.anim.move(piece, 5, dest);
  }
  T.fx.play(ev);

  // Freeze the animator and walk it forward ourselves. Replacing the instance
  // method leaves the prototype's copy to drive it from here, so the frame
  // loop's call becomes a no-op without touching main.js.
  const A = T.anim;
  const step = Object.getPrototypeOf(A).update.bind(A);
  A.update = () => {};
  const want = Number(q.get('ft') ?? 1300) / 1000;
  for (let s = 0; s < want; s += 1 / 120) step(1 / 120);
  return `earth -> ${dest} at ${want}s`;
})()
