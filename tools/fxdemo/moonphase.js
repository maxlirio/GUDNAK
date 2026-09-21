// Preview harness for ONE motif: moonphase.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&p0=The%20Masked&t=400&phase=3" \\
//     --eval tools/fxdemo/moonphase.js --out /tmp/mp-3-400.png --wait 9000 --settle 900
//
// ?t is MILLISECONDS INTO THE MOTIF and ?phase is which of the four rotations
// to show. --settle is WALL CLOCK and headless rendering runs animation time at
// a fraction of it, so the animator is taken off the frame clock here and
// stepped by hand to ?t, then frozen.
//
// The phase is handed in as an OBJECT — the motif believes an object outright,
// which is the only way to shoot rotation four without playing three turns
// first. In a real game the same value comes off the motif's own counter.
//
// ?strip=1 fires all four at once, each on its own beat, so the escalation can
// be judged in ONE frame; the four are drawn at the four corners' worth of
// spacing by playing them for player 0 and then shifting nothing — they share
// a plinth, so the strip mode instead shoots them at the SAME ?t and the four
// PNGs are compared side by side. Kept as separate shots on purpose: one frame
// with four moons in it is not the thing a player ever sees.
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

    // Scylla on the board, because the moon only turns while she is alive —
    // and a back row with a gap in it, which is where Charybdis will land.
    const put = (sq, def, own) => {
      const u = ++st.nextUid;
      st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
      return u;
    };
    st.board = Array.from({ length: 12 }, () => []);
    put(0, 'M003', 0);                 // Scylla, keeping the clock running
    put(4, 'A016', 1);                 // an enemy in the middle, for scale
    st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
    T.resync();

    // ?zoom=1 drops the camera on the plinth beside the Stronghold. The frame
    // loop re-places the camera every frame and then sways it, so the position
    // has to be frozen component by component and lookAt taken away; setting
    // it once is simply overwritten on the next frame.
    if (q.has('zoom')) {
      const cam = T.camera;
      cam.position.set(-2.2, 7.4, 11.4);
      cam.lookAt(-3.09, 0.7, 5.57);
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
      // lands short of ?t, and two shots hundreds of milliseconds apart then
      // come out pixel for pixel identical.
      for (let i = 0; i < 400 && clock < target; i++) {
        const s = Math.min(1 / 120, target - clock);
        clock += s;
        real(s);
      }
    };
    window.__mpAt = (ms) => { target = Math.max(target, ms / 1000); return target; };

    const phase = Math.max(1, Math.min(4, Number(q.get('phase') || 1)));
    T.fx.play({ kind: 'moonphase', at: { player: 0, phase } });
    window.__mpAt(Number(q.get('t') || 0));
    setTimeout(() => console.log('phase', phase, 'clock', clock.toFixed(3), 'of', target), 400);
    done(`moonphase ${phase} at ${q.get('t') || 0}ms`);
  };
  boot();
}))()
