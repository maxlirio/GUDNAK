// Preview harness for ONE effect: brand.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=450" \
//     --eval tools/fxdemo/brand.js --out /tmp/brand-450.png --settle 500
//
// `t` is the point IN THE MOTIF to freeze at, in milliseconds. --settle is
// wall clock, and headless Chrome renders this scene at about six frames a
// second with dt clamped to 50ms in main.js, so motif time runs at roughly a
// third of real time there: every shot taken at --settle 900 was really the
// brand 300ms in, and the cooling half — which is most of this effect — was
// never once looked at.
//
// So the animator is driven by hand instead. The first frame after the effect
// is booked steps it forward in 1/120s slices to exactly `t` and then freezes,
// which makes every screenshot an exact, repeatable point on the timeline.
//
// `two=1` fires it on two cards 90ms apart — the Lord High Inquisitor's
// Sentence convicts two fighters at once and both brands have to read.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const AT = Number(q.get('t') ?? 400) / 1000;
  const TWO = q.get('two') === '1';
  const GAP = Number(q.get('gap') ?? 90) / 1000;

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

  // Let the table settle first. `pieces.update` lerps a card to its resting
  // position and ROTATION over several frames, and a card that is still
  // turning when the brand grabs it (the effect sets `animating`, which stops
  // that lerp dead) sits at the wrong yaw for the whole motif — which looked
  // like the effect flipping the card and was purely this harness.
  const H = 1 / 120;
  for (let i = 0; i < 90; i++) { T.anim.update(H); T.pieces.update(H, T.camera); }

  // Hand-driven clock: step to `AT`, then stop dead. Everything that moves has
  // to be frozen together, or the parts still running on the real clock drift
  // on through the 500ms the screenshot takes.
  const anim = T.anim;
  const real = anim.update.bind(anim);
  const realPieces = T.pieces.update.bind(T.pieces);
  const realBoard = T.board.update.bind(T.board);
  let stepped = false;
  const freeze = () => {
    T.pieces.update = () => {};
    T.board.update = () => {};
    anim.update = () => {};
  };
  anim.update = () => {
    if (stepped) return;
    stepped = true;
    for (let s = 0; s < AT; s += H) { real(H); realPieces(H, T.camera); realBoard(H); }
    freeze();
  };

  const evs = [{ kind: 'brand', target: foe }];
  T.fx.play(evs[0]);
  if (TWO) {
    // the second conviction lands a beat later, booked on the same clock
    evs.push({ kind: 'brand', target: me });
    anim.add(Math.max(0.001, GAP), () => {}, () => T.fx.play(evs[1]));
  }
  return 'played t=' + AT + ' ' + JSON.stringify(evs);
})()
