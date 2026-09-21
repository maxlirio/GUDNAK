// Preview harness for ONE motif: echo.
//
//   node tools/shot.js --wait 10000 --settle 600 \
//     --url "game/?quick=1&seed=5&t=520" \
//     --eval tools/fxdemo/echo.js --out /tmp/ec-520.png
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// THE ACTING FIGHTER IS AT SQUARE 4, the middle of the board, with a
// neighbour on either side. The motif is a shuttle crossing the card and then
// crossing it AGAIN, and the pass is wider than a square on purpose — so the
// squares to left and right have to be occupied to see what the run looks
// like when it goes over somebody. ?sq= moves it; ?alone=1 clears the rest of
// the board, which is the case to check the two rings against.
//
// No deck is needed here: nothing in this motif touches The Void.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const DT = 1 / 120;

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const SQ = Number(q.get('sq') ?? 4);
  const me = put(SQ, 'A008', 0);            // Timeweaver
  if (!q.has('alone')) {
    for (const s of [3, 5, 7, 1]) if (s !== SQ) put(s, s % 2 ? 'A019' : 'M027', s % 2 ? 0 : 1);
  }
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const anim = T.anim;
  const at = Number(q.get('t') || 0) / 1000;

  if (q.has('live')) {
    T.fx.play({ kind: 'echo', at: me, faction: 'Auroxi' });
    return 'playing echo live';
  }

  const step = anim.update.bind(anim);
  anim.update = () => {};                   // off the frame clock, still drawing
  T.fx.play({ kind: 'echo', at: me, faction: 'Auroxi' });
  for (let s = 0; s < at; s += DT) step(DT);
  return 'echo frozen at ' + at.toFixed(2) + 's';
})()
