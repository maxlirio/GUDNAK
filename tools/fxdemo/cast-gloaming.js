// Preview harness for ONE effect: cast-gloaming.
//
//   node tools/shot.js --url "game/?quick=1&seed=5" \
//     --eval tools/fxdemo/cast-gloaming.js --out /tmp/cg-strip.png --settle 500 --wait 9000
//
// Two problems made the obvious "--settle 400" shot useless, and this harness
// exists to solve both.
//
// 1. WALL-CLOCK TIME IS NOT MOTIF TIME. Headless frames on a loaded machine
//    arrive a dozen a second, so --settle 400 showed the motif's 70ms mark one
//    run and its 500ms mark the next and two shots of the same code never
//    matched. So the table's animator is frozen the instant before the effect
//    fires and then hand-cranked in fixed 1/120s steps. Motif time is then
//    exactly what is asked for, every run, and --settle only has to be long
//    enough for one frame to be drawn.
//
// 2. ONE SHOT PER MOMENT IS TOO SLOW. A page load is a minute-plus here, so a
//    five-moment spread cost five minutes and a change of mind cost another
//    five. By DEFAULT this fires the flourish on six squares at staggered
//    times and then stops the clock once: the near two rows then hold six ages
//    of the same motif in a single picture — read them right to left, newest
//    first. That is also the shot that proves the motif reads at a glance and
//    does not shout, because six of them are on the table at once.
//
// ?at=N in the URL instead plays ONE, on the centre-left square, frozen N
// milliseconds in — the shot to take when a moment needs looking at closely.
// With neither, nothing is frozen and it just plays.
(() => {
  const T = window.__table, st = window.__table.state;
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];

  const q = new URLSearchParams(location.search);
  const at = Number(q.get('at'));
  const anim = T.anim;
  const DT = 1 / 120;
  const cast = (uid) => T.fx.play({ kind: 'cast', at: uid, faction: 'Gloaming' });

  // ---- one card, one moment
  if (Number.isFinite(at) && at > 0) {
    const me = put(3, 'A016', 0);
    put(5, 'M027', 1);
    put(1, 'A019', 0);
    T.resync();
    const step = anim.update.bind(anim);
    anim.update = () => {};            // the render loop keeps drawing, frozen
    cast(me);
    for (let s = 0; s < at / 1000; s += DT) step(DT);
    const w = T.fx.kit.at(me);
    return `frozen ${at}ms | at=${w ? [w.x, w.y, w.z].map((n) => n.toFixed(2)).join() : 'NULL'}`;
  }

  // ---- six ages at once, oldest on the left
  // The SAME card under all six, so the only difference in the picture is how
  // far into the motif it is. The first version dealt six different cards and
  // three of the ids did not exist, which drew blank white slabs — and a white
  // slab is the one surface on this table the shade reads beautifully on, so
  // it flattered the effect exactly where the real board would not.
  // Six moments inside the motif's 750ms. Change these with SPAN in the effect
  // — set one past the end and that square just holds a clean card, which is
  // easy to misread as the effect having failed.
  const AGES = [690, 560, 430, 300, 180, 70];
  const uids = AGES.map((_, i) => put(i, 'A016', 0));
  T.resync();

  if (!q.has('live')) {
    const step = anim.update.bind(anim);
    anim.update = () => {};
    let now = 0;
    const stepTo = (ms) => { while (now < ms - 0.5) { step(DT); now += 1000 * DT; } };
    AGES.forEach((a, i) => { stepTo(AGES[0] - a); cast(uids[i]); });
    stepTo(AGES[0]);
    return 'frozen ages (left to right) ' + AGES.join(',') + 'ms';
  }
  uids.forEach(cast);
  return 'playing live on 6 squares';
})()
