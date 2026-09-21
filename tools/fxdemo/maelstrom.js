// Preview harness for ONE motif: maelstrom.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&p0=The%20Masked&t=400&sq=4" \\
//     --eval tools/fxdemo/maelstrom.js --out /tmp/ms-400.png --wait 9000 --settle 900
//
// ?t is MILLISECONDS INTO THE MOTIF and ?sq is the whirlpool's square (default
// 4, the middle, so all four tongues have somewhere to go). ?prey=1 puts an
// enemy on every neighbour and ?prey=0 leaves the square alone, which is how
// the tongues and the haul are told apart from the water.
//
// --settle is WALL CLOCK and headless rendering runs animation time at a
// fraction of it, so the animator is taken off the frame clock here and
// stepped by hand to ?t, then frozen.
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
    const sq = Math.max(0, Math.min(8, Number(q.get('sq') ?? 4)));

    const put = (n, def, own) => {
      st.board[n] = [{ uid: ++st.nextUid, def, owner: own, fatigued: false, attachments: [] }];
    };
    st.board = Array.from({ length: 12 }, () => []);
    put(sq, 'M046C', 0);                   // the whirlpool itself
    // The prey. Every neighbour, so a single shot shows which bearings reach
    // and which do not — on the table only one of them is ever chosen, and the
    // rules choose it after this motif has already fired.
    const near = [];
    const col = sq % 3, row = (sq / 3) | 0;
    if (col > 0) near.push(sq - 1);
    if (col < 2) near.push(sq + 1);
    if (row > 0) near.push(sq - 3);
    if (row < 2) near.push(sq + 3);
    if (q.get('prey') !== '0') {
      for (const n of near) put(n, 'A016', 1);
    }
    st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
    T.resync();

    // ?zoom=1 drops the camera on the square. The frame loop re-places the
    // camera every frame and then sways it, so the position has to be frozen
    // component by component and lookAt taken away; setting it once is simply
    // overwritten on the next frame.
    if (q.has('zoom')) {
      const cam = T.camera;
      const x = (col - 1) * 2.62, z = (1 - row) * 2.62;
      cam.position.set(x + 0.4, 6.6, z + 7.4);
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
      for (let i = 0; i < 600 && clock < target; i++) {
        const s = Math.min(1 / 120, target - clock);
        clock += s;
        real(s);
      }
    };

    T.fx.play({ kind: 'maelstrom', at: sq });
    target = Number(q.get('t') || 0) / 1000;
    setTimeout(() => console.log('maelstrom sq', sq, 'clock', clock.toFixed(3)), 400);
    done(`maelstrom sq${sq} at ${q.get('t') || 0}ms`);
  };
  boot();
}))()
