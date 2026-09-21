// Preview harness for ONE motif: wander.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=900" \\
//     --eval tools/fxdemo/wander.js --out /tmp/wander-900.png \\
//     --wait 8000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and
// past about a second it deals over the board this sets up.
//
// The machine is busy and the table can take many seconds to build, so this
// POLLS for window.__table rather than assuming --wait was enough. Without it
// a slow load photographs the loading screen, which looks exactly like a
// motif that never fired.
//
// ?hop=1 fills the board so the only empty square left is next door, which
// forces the two-station version — the one-square move. Otherwise the board
// is left open and the motif walks in from the far corner.
// ?look=N centres the camera on a square (default 4) and ?fov=N narrows it.
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
    return st.board[sq][0].uid;
  };
  st.board = Array.from({ length: 12 }, () => []);

  // The Wanderer, already standing on its destination — the rules resolve
  // instantly and the table animates afterwards, so the motif never moves it.
  const home = Math.max(0, Math.min(8, Number(q.get('me') ?? 2)));
  const me = put(home, ['C164'], 0);
  // A REAL STACK of theirs next door: two cards on one square, which is what
  // "adjacent to target enemy stack" means and what the last shadow has to
  // reach onto.
  const foe = Math.max(0, Math.min(8, Number(q.get('foe') ?? 5)));
  put(foe, ['M027', 'M007'], 1);

  if (q.get('hop')) {
    // Everything occupied but one neighbour, so the walk is a single square.
    const keep = Number(q.get('hop')) >= 0 && Number(q.get('hop')) < 9
      ? Number(q.get('hop')) : 1;
    for (let sq = 0; sq < 9; sq++) {
      if (sq === home || sq === foe || sq === keep || st.board[sq].length) continue;
      put(sq, [sq % 2 ? 'A016' : 'A019'], sq % 3 === 0 ? 1 : 0);
    }
  } else {
    put(3, ['A019'], 0);            // a little company, well off the path
  }

  // RE-AIM. The game aims at (0, 0.2, 3.4), biased toward the near stronghold,
  // which parks the back row of squares under the HUD banner — and this motif
  // walks across the WHOLE board, so half the trail was behind the words
  // "Bolts of Destruction". placeCamera() runs every frame, so the re-aim has
  // to be wrapped round the camera rather than set once.
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
  T.anim.update = () => {};          // off the frame clock
  T.fx.play({ kind: 'wander', at: me, faction: 'Neutral' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);

  // ?tex=1 lays the motif's own canvases over the page, blown up, on three
  // bands of grey. The whole effect is hand-painted silhouettes fifteen
  // pixels wide on the table, and at that size a shape that is wrong and a
  // shape that is merely dark look identical in a board shot — two rounds
  // were spent guessing at a figure whose shoulders turned out to be there
  // all along and simply too soft. This shows what is actually in the map.
  if (q.get('tex')) {
    const seen = new Set();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:'
      + 'linear-gradient(90deg,#000 0 33%,#6b6257 33% 66%,#c8c0b0 66%)';
    // ONLY this motif's canvases. Walking every material in the scene dumped
    // eighty of them — every card face, every arena gradient — and the first
    // one on the page was a four-pixel sky strip blown up to fill the screen.
    // lit() stamps userData.order on the motif's own materials, so that is
    // what this filters on.
    T.arena.scene.traverse((o) => {
      if (o.material?.userData?.order === undefined) return;
      const img = o.material?.map?.image;
      if (!img || seen.has(img) || !img.getContext) return;
      seen.add(img);
      const c = img.cloneNode();
      c.getContext('2d').drawImage(img, 0, 0);
      c.style.cssText = `display:block;margin:14px;width:${img.width * 3.2}px;`
        + `height:${img.height * 3.2}px;image-rendering:pixelated`;
      box.appendChild(c);
    });
    document.body.appendChild(box);
    return `wander: ${seen.size} canvases`;
  }
  return `wander: me=${home} foe=${foe} frozen at ${at.toFixed(2)}s`;
})()
