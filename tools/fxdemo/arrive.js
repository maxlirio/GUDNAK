// Preview harness for ONE motif: arrive.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=520" \\
//     --eval tools/fxdemo/arrive.js --out /tmp/arrive-520.png \\
//     --wait 8000 --settle 500
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and past
// about a second it deals over the board this sets up.
//
// THE CARD IS DEALT IN FOR REAL. Half of this motif is timed against
// anim.deploy — the fractures run for exactly as long as the card is in the
// air and the impact lands on the frame it does — so a harness that dropped
// the fighter onto its square and then played the effect would be testing the
// one arrangement the game never produces. ?deploy=0 turns the flight off, to
// judge the ground on its own.
//
// The Chimera lands in the MIDDLE OF THE ENEMY LINE by default, because that
// is the whole reason the card exists: it is the only fighter in the game that
// can turn up anywhere.
//
// ?me is the square, ?zoom drops the camera in.
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
  const home = Math.max(0, Math.min(8, Number(q.get('me') ?? 4)));
  // C048 IS the Reckless Chimera.
  const me = put(home, 'C048', 0);
  for (const sq of [0, 2, 6, 8]) if (sq !== home) put(sq, 'M027', 1);

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  if (q.has('zoom')) {
    const cam = T.camera;
    const d = Number(q.get('zoom')) || 1;
    const c = [((home % 3) - 1) * 2.0, 0.2, (1 - Math.floor(home / 3)) * 2.0];
    cam.position.set(c[0], 0.2 + 8.2 / d, c[2] + 6.4 / d);
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
  const pc = T.pieces.get(me);
  if (q.get('deploy') !== '0') T.anim.deploy(pc, home);
  T.fx.play({ kind: 'arrive', at: me, faction: 'Shardsworn' });
  for (let s = 0; s < at; s += 1 / 120) real(1 / 120);

  // Everything here is a decal a few dozen pixels across and the shards are
  // eight; at that size "faint" and "never drawn" look identical in a still,
  // so what is actually on screen is printed rather than guessed at.
  const seen = {};
  T.arena.scene.traverse((o) => {
    if (!o.material?.transparent || o.renderOrder <= 0) return;
    if (o.material.opacity > 0.02) {
      seen[o.renderOrder] = (seen[o.renderOrder] || 0) + 1;
    }
  });
  const rest = pc.restingPosition();
  return `arrive me=${home} frozen at ${at.toFixed(2)}s`
    + ` — card ${(pc.group.position.y - rest.y).toFixed(2)} above home,`
    + ` layers ${JSON.stringify(seen)}`;
})()
