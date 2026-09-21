// Preview harness for ONE motif: phylactery.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=660" \\
//     --eval tools/fxdemo/phylactery.js --out /tmp/ph-660.png \\
//     --wait 10000 --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// The beats, in milliseconds, against SPAN = 1500:
//   75 drain   315 the soul tears free   465 the lantern's roof hinges up
//   660 THE CATCH   833 drawn down through the opening   867 the roof drops
//     and the lantern lights, and its blades of light snap out on the stone
//   1050 it drifts home   1350 it lowers itself onto the square
// 500 is worth a frame of its own (the roof open over an empty box) and so is
// 150, which is the lantern hanging there unlit with nothing holding it —
// that one is the whole reason the motif is creepy rather than merely lit, and
// it is the one a preview at a later `t` will never show you.
//
// Knobs:
//   &look=N   centre the camera on a square (default 4). The game aims at
//             (0, 0.2, 3.4) — biased toward the near stronghold — which parks
//             the back row under the HUD banner, and placeCamera() re-aims
//             every frame, so this has to be wrapped round the camera rather
//             than set once.
//   &fov=20   narrow the camera for a close look at the lantern. Use it to
//             check construction only — z-fighting between a pane and its
//             posts, a gap under the roof — and NEVER to judge whether the
//             thing reads. It is a 36-pixel object in the game and the last
//             pass on this motif was signed off at 4x and shipped a smudge.
//   &me=N     which square the dying Construct stands on (default 3)
//   &exit=1   ALSO run exit.destroy on the card, started at timing.kill the
//             way fx.js starts it, so the husk being dragged off can be
//             photographed against the motif that emptied it
//   &kill=N   move that start, in seconds
(async () => {
  // POLL. The board takes a variable few seconds to raise under SwiftShader
  // and longer with other shots running beside it; reading window.__table
  // straight off threw on a page that had simply not booted, and a shot of
  // the loading screen looks exactly like a motif that never drew.
  const T = await (async () => {
    for (let i = 0; i < 300; i++) {
      if (window.__table?.state && window.__table.fx) return window.__table;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('window.__table never appeared');
  })();
  const st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // NOT 1 and NOT 5: the two decoys below are nailed to those squares and the
  // second put() overwrites the dying card, `kit.at` then answers null, and
  // the motif silently does not run at all. Squares 6-8 are the FAR row (z is
  // negative there), 0-2 the near one, so `me=6` is the useful other test —
  // the soul flies toward the camera and the lantern hangs over the middle.
  const mySq = Math.max(0, Math.min(8, Number(q.get('me') ?? 3)));
  const me = put(mySq, 'A016', 0);     // the dying card
  put(5, 'M027', 1);                   // an enemy, so the board is not empty
  put(1, 'A019', 0);                   // a second fighter of yours

  {
    const sq = Number(q.get('look') ?? 4);
    const target = new (T.camera.position.constructor)(
      ((sq % 3) - 1) * 2.62, 0.2, (1 - Math.floor(sq / 3)) * 2.62);
    const aim = T.camera.lookAt.bind(T.camera);
    T.camera.lookAt = () => aim(target.x, target.y, target.z);
  }
  if (q.has('fov')) { T.camera.fov = Number(q.get('fov')); T.camera.updateProjectionMatrix(); }

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  T.fx.play({ kind: 'phylactery', at: me, faction: 'Gloaming' });

  // The exit is a SECOND animation that fx.js starts `timing.kill` seconds
  // after the motif, on the same piece — which is where the two can fight over
  // the card's colour. Firing it here, on the same hand-stepped clock, is the
  // only way to photograph that overlap.
  // Keep this in step with `timing.kill` in the motif — fx.js reads it from
  // the module and there is no way to ask for it from in here.
  const kill = q.get('exit') ? Number(q.get('kill') ?? 0.62) : null;
  const run = kill != null ? T.fx.exitFor([{ kind: 'phylactery' }], 'destroy') : null;
  let fired = false;
  let doneAt = null;

  for (let t = 0; t < at; t += 1 / 120) {
    if (run && !fired && t >= kill) {
      fired = true;
      run(T.pieces.get(me), mySq, () => { doneAt = t; });
    }
    real(1 / 120);
  }
  return 'phylactery at ' + at.toFixed(2) + 's'
    + (run ? ' | exit fired=' + fired + ' done=' + (doneAt == null ? 'no' : doneAt.toFixed(2)) : '');
})()
