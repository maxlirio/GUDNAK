// Preview harness for ONE effect: volley.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=260&n=4" \
//     --eval tools/fxdemo/volley.js --out /tmp/vo-260.png --settle 500
//
// `t` is the point IN THE MOTIF to freeze at, in milliseconds. --settle is
// wall clock, and headless Chrome draws this scene at about six frames a
// second with dt clamped to 50ms in main.js, so motif time there runs at
// roughly a third of real time: every shot taken at --settle 300 was really
// the volley about 100ms in, and the whole back half — impacts, debris, the
// dying embers — was never once looked at. Shots move fast enough that being
// wrong by 200ms means photographing a different effect.
//
// So the animator is driven by hand instead, exactly as tools/fxdemo/brand.js
// does: the first frame after the effect is booked steps it forward in 1/120s
// slices to exactly `t` and then freezes, which makes every screenshot a
// repeatable point on the timeline.
//
// `n` is how many squares are hit (1..4), because Barrage does both: one lone
// adjacent enemy, or a fighter ringed on all four sides. The shooter always
// stands on the centre square so the fan has somewhere to go.
// The table is waited for rather than assumed: with several headless Chromes
// on one machine this page can still be `interactive` six seconds in, and the
// harness then threw on `window.__table` before it had drawn anything. The
// #boot card has to be gone as well — `__table` exists a good while before the
// splash lifts, and shots taken in that window were photographs of the title.
(async () => {
  const up = () => window.__table && !document.getElementById('boot')?.offsetParent;
  for (let i = 0; i < 600 && !up(); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const AT = Number(q.get('t') ?? 300) / 1000;
  const N = Math.max(1, Math.min(4, Number(q.get('n') ?? 4)));

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(4, 'A016', 0);                 // your fighter, dead centre
  // Squares in sweep order: the fan opens left to right across the board, so
  // n=2 is a pair on one side rather than two squares facing each other.
  const SQ = [3, 1, 5, 7].slice(0, N);
  const foes = SQ.map((s, i) => put(s, ['M027', 'A019', 'M027', 'A019'][i], 1));

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // Let the table settle first. `pieces.update` lerps a card to its resting
  // position over several frames, and this motif knocks cards about — a card
  // still sliding into place when the volley grabs it (the effect sets
  // `animating`, which stops that lerp dead) sits wrong for the whole motif.
  const H = 1 / 120;
  for (let i = 0; i < 90; i++) { T.anim.update(H); T.pieces.update(H, T.camera); }

  // Hand-driven clock: step to `AT`, then stop dead. Everything that moves has
  // to be frozen TOGETHER — the recoil and the flinches live on pieces.update,
  // so freezing the animator alone let the struck cards go on lerping home
  // through the half second the screenshot takes.
  const anim = T.anim;
  const real = anim.update.bind(anim);
  const realPieces = T.pieces.update.bind(T.pieces);
  const realBoard = T.board.update.bind(T.board);
  let stepped = false;
  anim.update = () => {
    if (stepped) return;
    stepped = true;
    for (let s = 0; s < AT; s += H) { real(H); realPieces(H, T.camera); realBoard(H); }
    T.pieces.update = () => {};
    T.board.update = () => {};
    anim.update = () => {};
  };

  const ev = { kind: 'volley', from: me, targets: SQ };
  T.fx.play(ev);
  return 'played t=' + AT + ' ' + JSON.stringify(ev);
})()
