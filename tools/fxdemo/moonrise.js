// Preview harness for ONE motif: moonrise.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&p0=The%20Masked&t=900&sq=2" \\
//     --eval tools/fxdemo/moonrise.js --out /tmp/mr-900.png --wait 9000 --settle 900
//
// ?t is MILLISECONDS INTO THE MOTIF, ?sq is the square Charybdis lands on
// (default 2, a non-Gate square in player 0's Back Row, which is the only
// place the rules ever put it) and ?card=0 leaves the card off so the eye of
// the whirlpool can be seen — on the table it is covered by the card for the
// rest of the game, and both readings matter.
//
// --settle is WALL CLOCK and headless rendering runs animation time at a
// fraction of it, so the animator is taken off the frame clock here and
// stepped by hand to ?t, then frozen. Two shots hundreds of milliseconds apart
// otherwise come out pixel for pixel identical.
//
// window.__table is not there the instant the page loads on a busy machine and
// that failure looks exactly like a broken motif, so this polls for it.
(() => new Promise((done) => {
  let tries = 0;
  const boot = () => {
    if (!window.__table?.state) {
      if (++tries > 240) return done('NO TABLE — raise --wait');
      return void setTimeout(boot, 50);
    }
    const T = window.__table, st = T.state;
    const q = new URLSearchParams(location.search);
    const sq = Math.max(0, Math.min(8, Number(q.get('sq') ?? 2)));

    const put = (n, def, own) => {
      st.board[n] = [{ uid: ++st.nextUid, def, owner: own, fatigued: false, attachments: [] }];
    };
    st.board = Array.from({ length: 12 }, () => []);
    put(0, 'M003', 0);                         // Scylla, who kept the moon turning
    put(sq === 4 ? 5 : 4, 'A016', 1);          // an enemy in the middle, for scale
    put(3, 'M035', 0);                         // a neighbour, so the spill can be judged
    // Charybdis itself, unless ?card=0. It is put straight on the square
    // rather than deployed, because the deploy tween would be mid-flight at
    // most of the ?t values worth looking at.
    if (q.get('card') !== '0') put(sq, 'M046C', 0);
    st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
    T.resync();

    // ?zoom=1 drops the camera on the square. The frame loop re-places the
    // camera every frame and then sways it, so the position has to be frozen
    // component by component and lookAt taken away; setting it once is simply
    // overwritten on the next frame.
    if (q.has('zoom')) {
      const cam = T.camera;
      const x = (sq % 3 - 1) * 2.62, z = (1 - Math.floor(sq / 3)) * 2.62;
      cam.position.set(x + 0.4, 6.2, z + 7.0);
      cam.lookAt(x, 0.4, z);
      for (const k of ['x', 'y', 'z']) {
        const val = cam.position[k];
        Object.defineProperty(cam.position, k, { get: () => val, set: () => {} });
      }
      cam.lookAt = () => {};
    }

    const A = T.anim;
    const real = A.update.bind(A);
    let clock = 0, target = 0;
    A.update = () => {
      // The whole motif in one drawn frame if need be: a headless SwiftShader
      // frame is expensive enough that a fixed number of sub-steps silently
      // lands short of ?t.
      for (let i = 0; i < 600 && clock < target; i++) {
        const s = Math.min(1 / 120, target - clock);
        clock += s;
        real(s);
      }
    };

    T.fx.play({ kind: 'moonrise', at: sq });
    target = Number(q.get('t') || 0) / 1000;
    setTimeout(() => console.log('moonrise sq', sq, 'clock', clock.toFixed(3)), 400);
    done(`moonrise sq${sq} at ${q.get('t') || 0}ms`);
  };
  boot();
}))()
