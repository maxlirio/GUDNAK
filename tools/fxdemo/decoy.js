// Preview harness for ONE motif: decoy.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=600" \\
//     --eval tools/fxdemo/decoy.js --out /tmp/decoy-600.png \\
//     --wait 8000 --settle 500
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and past
// about a second it deals over the board this sets up.
//
// ?stack=1 deploys a real card ON TOP of the villager, which is the whole
// point of the rule ("you may Deploy IIs or IIIs on top of it") and the case
// the motif has to get right: the lid it lifts is then somebody else's card
// and the villager is underneath it.
//
// ?me is the square (default 4, the middle, because that is where a 60-pixel
// card can actually be looked at) and ?zoom drops the camera in.
(async () => {
  for (let i = 0; i < 400 && !window.__table?.state; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table;
  if (!T?.state) return 'no __table';
  const st = T.state;
  const q = new URLSearchParams(location.search);

  const put = (sq, defs, own) => {
    st.board[sq] = defs.map((def) => ({
      uid: ++st.nextUid, def, owner: own, fatigued: false, attachments: [],
    }));
    // The villager is the BOTTOM of the stack, which is where the rule puts it.
    return st.board[sq][st.board[sq].length - 1].uid;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const home = Math.max(0, Math.min(8, Number(q.get('me') ?? 4)));
  // M025 IS the Totally Normal Villager.
  const me = q.get('stack')
    ? put(home, ['M017', 'M025'], 0)
    : put(home, ['M025'], 0);
  put(home === 1 ? 5 : 1, ['A016'], 1);     // company, well off the card
  put(home === 7 ? 3 : 7, ['A019'], 0);

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  if (q.has('zoom')) {
    const cam = T.camera;
    const d = Number(q.get('zoom')) || 1;
    const c = [((home % 3) - 1) * 2.62, 0.2, (1 - Math.floor(home / 3)) * 2.62];
    cam.position.set(c[0], 0.2 + 7.2 / d, c[2] + 5.6 / d);
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
  T.fx.play({ kind: 'decoy', at: me, faction: 'Marvorren' });
  for (let s = 0; s < at; s += 1 / 120) real(1 / 120);

  // ?tex=1 lays this motif's own canvases over the page, blown up, on three
  // bands of grey. Everything in this effect is a hand-painted decal about
  // forty pixels across on the table, and at that size a shape that is wrong
  // and a shape that is merely soft look identical in a board shot — a round
  // was spent hunting for two horns that turned out to be drawn correctly and
  // blurred to nothing. This shows what is actually in the map.
  if (q.get('tex')) {
    const seen = new Set();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:'
      + 'linear-gradient(90deg,#000 0 33%,#6b6257 33% 66%,#c8c0b0 66%)';
    // ONLY this motif's canvases: every decal it makes is transparent, has a
    // uv attribute and a renderOrder it set by hand, which nothing in the
    // arena does.
    T.arena.scene.traverse((o) => {
      if (!o.material?.transparent || o.renderOrder <= 0) return;
      const img = o.material.map?.image;
      if (!img || seen.has(img) || !img.getContext) return;
      seen.add(img);
      const c = img.cloneNode();
      c.getContext('2d').drawImage(img, 0, 0);
      c.style.cssText = `display:block;margin:12px;width:${img.width * 2.6}px;`
        + `height:${img.height * 2.6}px`;
      box.appendChild(c);
    });
    document.body.appendChild(box);
    return `decoy: ${seen.size} canvases`;
  }

  // What is actually drawn, and how strongly. Every plate in this motif is a
  // decal a few dozen pixels across, and at that size "faint" and "never
  // faded up" look identical in a still — so the opacities are printed rather
  // than guessed at from the picture.
  const seen = [];
  T.arena.scene.traverse((o) => {
    if (o.material?.opacity === undefined || o.renderOrder === 0) return;
    if (!o.material.transparent || !o.geometry?.attributes?.uv) return;
    if (o.material.opacity > 0.01) seen.push(`r${o.renderOrder}@${o.material.opacity.toFixed(2)}`);
  });
  return `decoy me=${home} stack=${q.get('stack') ? 1 : 0} frozen at ${at.toFixed(2)}s`
    + ` — ${seen.join(' ') || 'NOTHING VISIBLE'}`;
})()
