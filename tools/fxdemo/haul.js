// Preview harness for ONE motif: haul.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=420" \\
//     --eval tools/fxdemo/haul.js --out /tmp/haul-420.png \\
//     --wait 8000 --settle 500
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and past
// about a second it deals over the board this sets up.
//
// TWO CARDS A SQUARE APART, and the second one PINNED where it came from —
// which is what main.js does with every card the rules moved while it waits
// out a motif's timing.kill, and the only place the direction of the tow
// exists for the effect to read. The harness also drives the real slide
// afterwards with anim.move, because half of this motif is the trace staying
// attached to a card that is moving.
//
// ?me is the mammoth's square, ?you is where the towed fighter ENDS UP, and
// ?was is where it came from — so the tow can be looked at running toward the
// camera, away from it and across, which are three quite different pictures at
// a fixed 52-degree elevation.
(async () => {
  for (let i = 0; i < 400 && !window.__table?.state; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table;
  if (!T?.state) return 'no __table';
  const st = T.state;
  const q = new URLSearchParams(location.search);

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);

  const me = Math.max(0, Math.min(8, Number(q.get('me') ?? 4)));      // the mammoth
  const you = Math.max(0, Math.min(8, Number(q.get('you') ?? 3)));    // where it ends
  const was = Math.max(0, Math.min(8, Number(q.get('was') ?? 6)));    // where it was
  const mammoth = put(me, 'A016', 0);
  const follower = put(you, 'A019', 0);
  put(me === 2 ? 5 : 2, 'M027', 1);          // company, off the line

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // Pin the follower where it came from, exactly as main.js does.
  const fp = T.pieces.get(follower);
  fp.animating = true;
  fp.group.position.set(((was % 3) - 1) * 2.62, fp.group.position.y,
    (1 - Math.floor(was / 3)) * 2.62);

  if (q.has('zoom')) {
    const cam = T.camera;
    const d = Number(q.get('zoom')) || 1;
    const c = [((me % 3) - 1) * 1.6, 0.2, (1 - Math.floor(me / 3)) * 1.6];
    cam.position.set(c[0], 0.2 + 9.0 / d, c[2] + 7.0 / d);
    cam.lookAt(c[0], 0.2, c[2]);
    for (const k of ['x', 'y', 'z']) {
      const val = cam.position[k];
      Object.defineProperty(cam.position, k, { get: () => val, set: () => {} });
    }
    cam.lookAt = () => {};
  }

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  T.fx.play({ kind: 'haul', at: mammoth, faction: 'Auroxi' });
  // ...and the slide the motif is waiting for, released at the declared
  // timing.kill. Without it the follower never actually goes anywhere and the
  // half of the effect that is about a moving card cannot be judged at all.
  const kill = 1.5 * 0.30;
  T.anim.add(kill, () => {}, () => T.anim.move(fp, was, you));
  for (let s = 0; s < at; s += 1 / 120) real(1 / 120);

  const d = fp.group.position.distanceTo(fp.restingPosition());
  return `haul me=${me} ${was}->${you} frozen at ${at.toFixed(2)}s`
    + ` — follower still ${d.toFixed(2)} from home`;
})()
