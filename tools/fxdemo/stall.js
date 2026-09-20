// Preview harness for ONE motif: stall.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300&seedfx=3" \\
//     --eval tools/fxdemo/stall.js --out /tmp/stall-300.png \\
//     --wait 4000 --settle 600
//
// --settle 1400 is TOO LONG: the table's opening deal keeps running in real
// time and lays cards over the board this harness set up.
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
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

  // Every cast rolls its own lumps, relief and dust, which is the point of the
  // motif and makes two screenshots of two different tunings impossible to
  // compare — twice I "fixed" a layout that was really just a different roll.
  // &seedfx pins the dice for the preview only.
  const sf = Number(q.get('seedfx') || 0);
  if (sf) {
    let a = (sf * 1831565813) >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  T.fx.play({ kind: 'stall', at: me, faction: 'Shardsworn' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played stall frozen at ' + at.toFixed(2) + 's';
})()
