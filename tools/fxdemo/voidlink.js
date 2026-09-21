// Preview harness for ONE motif: voidlink.
//
//   node tools/shot.js --wait 10000 --settle 600 \
//     --url "game/?quick=1&seed=5&p0=The%20Voidbringers&t=420" \
//     --eval tools/fxdemo/voidlink.js --out /tmp/vl-420.png
//
// THE DECK MATTERS and getting it wrong is silent. `p0=The Voidbringers` is
// the deck that opens the Void — board.js only draws the pit for a deck that
// mentions it — and half this motif happens AT the pit. main.js matches ?p0=
// by exact name and falls back to the FIRST deck in the list when it misses,
// with nothing logged, so a misspelt name hands you a board with no pit on it
// and a cord running off into bare dirt.
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// THE ACTING FIGHTER IS AT SQUARE 5 — the far corner of the middle row, the
// longest run on the table from the pit — with allies on 4 and 3 standing
// between it and the Void. That is deliberate: the cord is carried OVER the
// board, and a span with nothing to pass above never shows that it is up in
// the air at all. ?sq= moves it.
//
// SOMETHING IS STANDING IN THE VOID. The whole card is "this fighter has the
// abilities of all fighters that are in The Void", so square 9 is stocked by
// default — and a card lying on the pit covers the throat, which is where the
// cord is spun from. ?empty=1 clears it to check the other case.
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
  const SQ = Number(q.get('sq') ?? 5);
  const me = put(SQ, 'M184', 0);              // Shadow Hunter — the Voidlink card
  for (const s of [4, 3, 7]) if (s !== SQ) put(s, s === 3 ? 'A019' : 'M027', s === 3 ? 0 : 1);
  if (!q.has('empty')) put(9, 'M162', 0);     // a fighter standing in The Void
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const anim = T.anim;
  const at = Number(q.get('t') || 0) / 1000;

  if (q.has('live')) {
    T.fx.play({ kind: 'voidlink', at: me, faction: 'Auroxi' });
    return 'playing voidlink live';
  }

  const step = anim.update.bind(anim);
  anim.update = () => {};                     // off the frame clock, still drawing
  T.fx.play({ kind: 'voidlink', at: me, faction: 'Auroxi' });
  for (let s = 0; s < at; s += DT) step(DT);
  return 'voidlink frozen at ' + at.toFixed(2) + 's';
})()
