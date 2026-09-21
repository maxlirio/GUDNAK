// Preview harness for ONE motif: bulwark.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=220" \\
//     --eval tools/fxdemo/bulwark.js --out /tmp/bulwark-220.png \\
//     --wait 8000 --settle 500
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and past
// about a second it deals over the board this sets up.
//
// TWO FACTIONS SHARE THIS MOTIF — Threadbearer is Auroxi and Swarmseeker is
// Gloaming — and they look nothing alike, so ?faction=Auroxi|Gloaming is not
// a convenience: a band tuned against one of them and never looked at in the
// other is half tested. ?both=1 fires it on two fighters at once, which is the
// only way to compare the two colours in one frame.
//
// ?me is the square (default 4) and ?zoom drops the camera in. ?tex=1 dumps
// the motif's own canvas blown up on three bands of grey.
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
  // A007 IS the Threadbearer. Its neighbour is an enemy, because both cards
  // only pay out next to somebody.
  const me = put(home, 'A007', 0);
  const other = put(home === 3 ? 5 : 3, 'C048', 1);
  put(home === 7 ? 1 : 7, 'M027', 1);

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  if (q.has('zoom')) {
    const cam = T.camera;
    const d = Number(q.get('zoom')) || 1;
    const c = [((home % 3) - 1) * 2.0, 0.2, (1 - Math.floor(home / 3)) * 2.0];
    cam.position.set(c[0], 0.2 + 7.6 / d, c[2] + 5.9 / d);
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
  const faction = q.get('faction') || 'Auroxi';
  T.fx.play({ kind: 'bulwark', at: me, faction });
  if (q.get('both')) T.fx.play({ kind: 'bulwark', at: other, faction: 'Gloaming' });
  for (let s = 0; s < at; s += 1 / 120) real(1 / 120);

  if (q.get('tex')) {
    const seen = new Set();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:'
      + 'linear-gradient(90deg,#000 0 33%,#6b6257 33% 66%,#c8c0b0 66%)';
    T.arena.scene.traverse((o) => {
      if (!o.material?.transparent || o.renderOrder <= 0) return;
      const img = o.material.map?.image;
      if (!img || seen.has(img) || !img.getContext) return;
      seen.add(img);
      const c = img.cloneNode();
      c.getContext('2d').drawImage(img, 0, 0);
      c.style.cssText = `display:block;margin:12px;width:${img.width * 1.9}px;`
        + `height:${img.height * 1.9}px`;
      box.appendChild(c);
    });
    document.body.appendChild(box);
    return `bulwark: ${seen.size} canvases`;
  }

  // The band is a chamfered outline a few pixels thick and the press is under
  // a pixel; at that size "faint" and "never drawn" look identical in a still,
  // so both are printed rather than guessed at from the picture.
  const seen = [];
  T.arena.scene.traverse((o) => {
    if (!o.material?.transparent || o.renderOrder <= 0) return;
    if (o.material.opacity > 0.01) {
      seen.push(`r${o.renderOrder}@${o.material.opacity.toFixed(2)}x${o.scale.x.toFixed(2)}`);
    }
  });
  const pc = T.pieces.get(me);
  return `bulwark ${faction} me=${home} frozen at ${at.toFixed(2)}s`
    + ` — ${seen.join(' ') || 'NOTHING VISIBLE'}`
    + ` press ${(pc.group.position.y - pc.restingPosition().y).toFixed(3)}`;
})()
