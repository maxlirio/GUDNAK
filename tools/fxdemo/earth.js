// Preview harness for ONE effect: earth.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=200" \
//     --eval tools/fxdemo/earth.js --out /tmp/earth-200.png --settle 500
//
// `t` is the moment to photograph in MILLISECONDS INTO THE ENDING — measured
// from the frame the cloth grips, which is where `heave` starts and the only
// clock any of its beats are keyed to. `ft` is the same number counted from
// the start of the throw instead, for looking at the bolt itself. Either way
// it is the number that matters: --settle is only "give the page long enough
// to draw one frame".
//
// The card is THROWN, and it is over in under a third of a second: it leaves
// the stone at t=75, is at the top of its arc around t=210 and lands at t=340,
// so anything coarser than about 30ms between shots walks straight past the
// turn. The beats to look at are t=0 (the break), 75 (launch), 140, 210
// (apex, on its back), 280, 340 (the landing the grit and the shock ring are
// keyed to) and 450 (flat, square and face up again).
//
// Why not just use --settle? main.js clamps the frame delta to 0.05s, so on a
// software renderer running at five frames a second the animator advances at a
// quarter of wall-clock speed and --settle 1300 photographs the motif at about
// 300ms. Every early shot of this effect came back as an empty table for that
// reason. So the harness freezes the animator, steps it by hand to exactly the
// requested time, and lets the page carry on rendering that frozen frame.
//
// `dst` picks the square they are shoved to: 8 is straight away from the
// camera (the shove foreshortens, and so does the flip — the card tips toward
// and away from the viewer instead of across), 4 is across the screen, where
// the turn is broadside and reads biggest. Both need looking at, because the
// push direction is the whole point of this ending. `dst=99` is not a square
// at all, which is how to see the blocked case — the bolt has them but there
// is nowhere to put them, and nothing is thrown.
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
  // THE VICTIM HAS TO BE PINNED, exactly the way main.js pins him, or the shot
  // is of a case the game never plays.
  //
  // cloth.js reports the Earth Bolt as a CARRYING motif, so main.js resolves
  // the move on the rules side — the far square is his and the near one is
  // empty — then stands the card back on the square it left and holds
  // `animating` so pieces.js's homing lerp cannot walk it home. `heave` finds
  // it by that pair of facts and does the throwing itself.
  //
  // The two halves both matter and each one alone is wrong: change only the
  // board and pieces.js lerps the card to the far square on the next frame;
  // move only the card and its resting place is still the near square, so
  // `thrown` cannot recognise it and nothing is thrown at all.
  //
  // `slide=1` restores the OLD behaviour — the table's generic move — which is
  // the thing the toss replaced and the only way to photograph the two side
  // by side.
  if (dest >= 0 && dest < 9 && dest !== 5) {
    const piece = T.pieces.get(foe);
    const held = piece.group.position.clone();
    st.board[dest] = st.board[5]; st.board[5] = [];
    T.resync();
    piece.group.position.copy(held);    // fx.play reads this, and it is behind
    if (q.get('slide')) T.anim.move(piece, 5, dest);
    else piece.animating = true;
  }
  T.fx.play(ev);

  // Freeze the animator and walk it forward ourselves. Replacing the instance
  // method leaves the prototype's copy to drive it from here, so the frame
  // loop's call becomes a no-op without touching main.js.
  const A = T.anim;
  const step = Object.getPrototypeOf(A).update.bind(A);
  A.update = () => {};
  // Where the ending starts: cloth-kit.js grips at 0.61 of a 1.95s throw.
  const GRIP = 0.61 * 1.95;
  const want = q.has('t') ? GRIP + Number(q.get('t')) / 1000
    : Number(q.get('ft') ?? 1300) / 1000;
  // A 120th of a second a step, because the toss is over in 0.27s and the card
  // turns a full circle inside it: stepped at a 30th the shot lands up to 12
  // degrees of turn away from the moment asked for, which is the difference
  // between a card on its back and a card edge-on.
  for (let s = 0; s < want; s += 1 / 120) step(1 / 120);
  // WHERE THE CARD IS, reported back. A card is sixty pixels across in a frame
  // of 1280 and the toss puts it somewhere new every 8ms, so finding it in a
  // shot by eye costs more than taking the shot: `px` is its centre projected
  // to the viewport, which is where to point a crop, and `y` and `tilt` say
  // how high it is and how far round it has gone without having to measure
  // either off the picture. `anim` false before the motif is over means
  // something let go of the card early.
  const fp = T.pieces.get(foe);
  const at = fp.group.position;
  const ndc = at.clone().project(T.camera);
  const rot = [fp.tilt.rotation.x, fp.tilt.rotation.y, fp.tilt.rotation.z];
  return `earth -> ${dest} at ${want.toFixed(3)}s (t=${((want - GRIP) * 1000) | 0}ms)`
    + ` card=${at.toArray().map((n) => n.toFixed(2)).join(',')}`
    + ` tilt=${rot.map((n) => n.toFixed(2)).join('/')} anim=${!!fp.animating}`
    + ` px=${(((ndc.x + 1) / 2) * innerWidth) | 0},${(((1 - ndc.y) / 2) * innerHeight) | 0}`;
})()
