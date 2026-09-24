// Preview harness for ONE motif: reprieve.
//
//   node tools/shot.js --wait 10000 --settle 600 \
//     --url "game/?quick=1&seed=5&t=900" \
//     --eval tools/fxdemo/reprieve.js --out /tmp/rp-900.png
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// THE FIGHTER IS STAGED FATIGUED, and so are its neighbours. That is the
// whole case the motif is about — a spent fighter given its turn back — and a
// harness that stages a fresh one is testing the wrong thing: `fatigued: true`
// goes on the card and resync greys it through pieces.js, exactly as the board
// would. Against FRESH neighbours any brightening in the middle looks like the
// lighting rather than like one card coming back, which is why the whole row
// is spent here. ?fresh=1 stages the middle card unfatigued instead, which is
// the other live case (a Timeweaver standing in your Gates is usually not
// spent) and the reason the motif brings its own grey rather than leaning on
// the card's. ?alone=1 clears the neighbours, ?sq= moves it, ?def= swaps the
// card (A010 Fateweaver by default, A008 Timeweaver is the other one).
//
// No deck is needed here: nothing in this motif touches The Void.
(async () => {
  // main.js builds the table from a fetch, so on a cold page __table does not
  // exist yet and a harness that assumed it did staged nothing at all and
  // screenshotted an empty board.
  for (let i = 0; i < 400 && !window.__table; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table;
  if (!T) return 'no __table';
  const st = T.state;
  const q = new URLSearchParams(location.search);
  const DT = 1 / 120;

  const put = (sq, def, own, spent) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: !!spent, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const SQ = Number(q.get('sq') ?? 4);
  const me = put(SQ, q.get('def') || 'A010', 0, !q.has('fresh'));   // Fateweaver
  if (!q.has('alone')) {
    [3, 5, 7, 1].forEach((s, i) => {
      if (s !== SQ) put(s, i % 2 ? 'A019' : 'M027', i % 2 ? 0 : 1, true);
    });
  }
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // pieces.js EASES the grey in at dt*7 and this table draws at two or three
  // frames a second headless, so a card staged fatigued is still most of the
  // way bright when the shot is taken. Snap every piece to its target, or the
  // motif is judged against a row that was never actually spent.
  // Setting the field is not enough on its own: `grey` is only READ inside
  // Piece.update, which is where the front material actually gets dimmed, so
  // one update has to be run by hand or the row is still bright in the shot.
  for (const piece of T.pieces.byUid.values()) {
    piece.grey = piece.greyTarget;
    piece.update(0.5, T.camera);
  }

  // &fxzoom narrows the field of view for a close look. JUDGE AT ZOOM 1 as
  // well: a card is about sixty screen pixels on the real table, and that is
  // the size at which this motif has to stop being abstract.
  const zoom = Number(q.get('fxzoom') || 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  const anim = T.anim;
  // ?t is stepped in 1/120s ticks, so ?t=0 runs the tick ZERO times and the
  // pall's vertices are still the zeroes the buffer was born with — a
  // degenerate mesh at the world origin, which looks exactly like the motif
  // not firing. The first honest frame is ?t=10.
  const at = Number(q.get('t') || 0) / 1000;

  if (q.has('live')) {
    T.fx.play({ kind: 'reprieve', at: me, faction: 'Auroxi' });
    return 'playing reprieve live';
  }

  const step = anim.update.bind(anim);
  anim.update = () => {};                   // off the frame clock, still drawing
  T.fx.play({ kind: 'reprieve', at: me, faction: 'Auroxi' });
  for (let s = 0; s < at; s += DT) step(DT);
  return 'reprieve frozen at ' + at.toFixed(2) + 's';
})()
