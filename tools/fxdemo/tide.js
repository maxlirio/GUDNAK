// Preview harness for ONE motif: tide.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=800" \\
//     --eval tools/fxdemo/tide.js --out /tmp/tide-800.png --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// THE WHOLE NEAR ROW is filled, because a row is the case this motif exists
// for — judging it on one card would hide the only question that matters, and
// the three are Marvorren fighters because blue-green card art is the ground
// the water has to stay legible against. Square 4 holds an enemy one row in:
// the flood must sweep its own row and stop, not wash the board.
//
// It waits for the card art before it fires, and returns a promise so the shot
// tool waits too — the card JPEGs land well after the page does and a shot
// taken early has BLACK cards in it, which is unjudgeable here.
//
// window.__mvAt(ms) winds the frozen clock on to a later moment, so one page
// load can yield a whole spread of frames.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // ?row=0|1|2 puts the fighters in that row — 0 is nearest the camera. The
  // motif reads the row off the card that resolved, and a tide that only ever
  // works on the row the harness happens to use is a tide with a constant in
  // it.
  const row = Math.max(0, Math.min(2, Number(q.get('row') ?? 0))) * 3;
  put(row + 0, 'M016', 0);             // the row, filled: a Sea Soldier,
  const me = put(row + 1, 'M020', 0);  // the caster in the middle of it,
  put(row + 2, 'M027', 0);             // and a third fighter at the far end
  put(row === 0 ? 4 : 1, 'A016', 1);   // a neighbouring row, which must stay dry
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // ?zoom=1 drops the camera in on the near row for a detail look — the same
  // angle, three times closer, so a foam edge can be judged as an edge. The
  // frame loop re-places the camera every frame and then sways it, so the
  // position is frozen component by component and lookAt is taken away;
  // setting it once just gets overwritten on the next frame.
  // ?zoom=row looks at the whole row from three times closer; ?zoom=0|1|2
  // drops onto one square of it, which is the only way to judge a foam edge.
  if (q.has('zoom')) {
    const cam = T.camera;
    const z = q.get('zoom');
    const cx = z === 'row' ? 0 : (Number(z) - 1) * 2.62;
    const d = z === 'row' ? 1 : 0.62;
    cam.position.set(cx, 0.2 + 6.7 * d, 2.62 + 5.4 * d);
    cam.lookAt(cx, 0.2, 2.62);
    for (const k of ['x', 'y', 'z']) {
      const val = cam.position[k];
      Object.defineProperty(cam.position, k, { get: () => val, set: () => {} });
    }
    cam.lookAt = () => {};
  }

  const A = T.anim;
  const real = A.update.bind(A);
  let clock = 0, target = 0, steps = 0, cost = 0;
  A.update = () => {
    // The WHOLE motif in one frame if need be. At 40 sub-steps a frame this
    // could only advance a third of a second per drawn frame, and a headless
    // SwiftShader frame is expensive enough that ?t=2000 was silently landing
    // at 1.3s — two shots several hundred milliseconds apart came out pixel
    // for pixel identical, which is what gave it away.
    const t0 = performance.now();
    for (let i = 0; i < 400 && clock < target; i++) {
      const s = Math.min(1 / 120, target - clock);
      clock += s;
      real(s);
      steps++;
    }
    // What one tick of the motif costs. The sheet is six figures of vertex
    // arithmetic a frame and this is the only place it gets measured.
    cost += performance.now() - t0;
  };
  window.__mvAt = (ms) => { target = Math.max(target, ms / 1000); return target; };

  const painted = () => {
    let waiting = false;
    for (const p of T.pieces.byUid.values()) {
      p.group.traverse((o) => {
        for (const m of [].concat(o.material || [])) {
          const img = m?.map?.image;
          if (m?.map && (!img || !img.width)) waiting = true;
        }
      });
    }
    return !waiting;
  };

  return new Promise((done) => {
    let tries = 0;
    const go = () => {
      if (painted() || ++tries > 120) {
        T.fx.play({ kind: 'tide', at: me, faction: 'Marvorren' });
        window.__mvAt(Number(q.get('t') || 0));
        // Printed so the shot log says where the frame actually landed, which
        // is the only proof the clock got there.
        setTimeout(() => {
          // ... and where the three fighters ended up, because a shove of a
          // tenth of a square is a handful of pixels and the eye cannot tell
          // it from none at all in a still.
          const where = [...T.pieces.byUid.values()]
            .filter((p) => Math.floor(p.square / 3) === row / 3)
            .map((p) => `${p.square}:${(p.group.position.x - p.restingPosition().x).toFixed(2)}`
              + `/${(p.group.position.y - p.restingPosition().y).toFixed(2)}`
              + `/${p.group.rotation.z.toFixed(2)}`)
            .join(' ');
          console.log('clock', clock.toFixed(3), 'of', target,
            `${(cost / Math.max(1, steps)).toFixed(2)}ms/tick`, 'dx/dy/roll', where);
        }, 500);
        done(`played, art ${painted() ? 'ready' : 'GAVE UP waiting'}`);
      } else setTimeout(go, 50);
    };
    go();
  });
})()
