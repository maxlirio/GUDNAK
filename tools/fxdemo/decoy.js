// Preview harness for ONE motif: decoy.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=560" \\
//     --eval tools/fxdemo/decoy.js --out /tmp/decoy-560.png \\
//     --wait 10000 --settle 600
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame — and must NOT
// be long, because the table's own opening keeps running in real time and past
// about a second it deals over the board this sets up.
//
// WHAT IT STAGES, and it is the whole point of the card: "While this fighter
// is in your Back Row, you may Deploy IIs or IIIs on top of it. Before you do,
// put this fighter into your hand without its stack." So the villager LEAVES
// and the card you deployed lands where it stood. This harness does that swap
// the way main.js does it — the villager off the board and into hand, the III
// dealt in on the square it left, its piece kept alive by `retain` until the
// motif's own exit.hand has finished taking it — because the two halves of
// this effect only make sense against each other: the cover has to be shut
// before the card goes and still shut when it has gone.
//
// ?solo=1 leaves the villager standing and nothing leaves, which is what the
// engine does today (the rules file does not yet implement the hand clause).
// ?me is the square and it is clamped to 0..2, player 0's BACK ROW — the only
// place the rule works, and the row nearest the camera, where a 60-pixel card
// is at its biggest. ?def= swaps the card that gets deployed on top.
// ?zoom drops the camera in.
(async () => {
  for (let i = 0; i < 400 && !window.__table?.state; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table;
  if (!T?.state) return 'no __table';
  const st = T.state;
  const q = new URLSearchParams(location.search);

  const card = (def, own) => ({
    uid: ++st.nextUid, def, owner: own, fatigued: false, attachments: [],
  });

  st.board = Array.from({ length: 12 }, () => []);
  const home = Math.max(0, Math.min(2, Number(q.get('me') ?? 1)));
  // M025 IS the Totally Normal Villager.
  const villager = card('M025', 0);
  st.board[home] = [villager];
  // Company, well clear of the square — the cover is 3.1 units across and it
  // has to be shown NOT reaching a neighbouring card.
  st.board[5] = [card('A016', 1)];
  st.board[7] = [card('A019', 0)];

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();
  const vp = T.pieces.get(villager.uid);

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
  T.anim.update = () => {};            // off the frame clock, from here on

  const ev = { kind: 'decoy', at: villager.uid, faction: 'Marvorren' };
  let note = 'solo';
  if (!q.has('solo')) {
    const played = card(q.get('def') || 'M022', 0);   // Moonlit Brute, a III
    st.board[home] = [played];
    st.players[0].hand.push(villager);
    // `retain` is what main.js does with a card that has left the board but
    // has not finished leaving on screen. Without it pieces.sync disposes the
    // villager on the spot and the whirlwind closes over an empty square.
    T.pieces.sync(st, { retain: new Set([villager.uid]) });

    const np = T.pieces.get(played.uid);
    // Dealt FROM THE HAND. anim.deploy with no origin arcs 2.6 units up and
    // comes down through the cover from above; from a hand seat it is a 0.9
    // hop that stays under the whirlwind's own height.
    const from = np.restingPosition();
    from.z += 4.6; from.x -= 1.4;
    T.anim.deploy(np, home, undefined, from);

    const leave = T.fx.exitFor([ev], 'hand');
    const wait = T.fx.killWait([ev]);
    T.anim.add(Math.max(0.001, wait), () => {}, () => {
      const finish = () => T.pieces.retire(villager.uid);
      if (leave) leave(vp, home, finish);
      else T.anim.vanish(vp, finish);
    });
    note = `swap def=${played.def} kill=${wait.toFixed(2)}${leave ? '' : ' NO-EXIT'}`;
  }

  T.fx.play(ev);
  for (let s = 0; s < at; s += 1 / 120) real(1 / 120);

  // ?tex=1 lays this motif's own canvases over the page, blown up, on three
  // bands of grey. The cover is a 256px disc that lands on the table about a
  // hundred pixels across, and at that size a spiral arm that is wrong and one
  // that is merely soft look identical in a board shot.
  if (q.get('tex')) {
    const seen = new Set();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:'
      + 'linear-gradient(90deg,#000 0 33%,#6b6257 33% 66%,#c8c0b0 66%)';
    // ONLY this motif's canvases. Every part of it is named 'decoy-*', which
    // is cheaper and far more honest than guessing from renderOrder — the
    // ribbons render at 0, the same as the whole arena.
    T.arena.scene.traverse((o) => {
      if (!o.name.startsWith('decoy-')) return;
      const img = o.material?.map?.image;
      if (!img || seen.has(img) || !img.getContext) return;
      seen.add(img);
      const c = img.cloneNode();
      c.getContext('2d').drawImage(img, 0, 0);
      c.style.cssText = `display:block;margin:12px;width:${img.width * 1.6}px;`
        + `height:${img.height * 1.6}px`;
      box.appendChild(c);
    });
    document.body.appendChild(box);
    return `decoy: ${seen.size} canvases`;
  }

  // WHAT IS ACTUALLY DRAWN, and how strongly. Everything here is a decal a few
  // dozen pixels across and at that size "faint" and "never faded up" are the
  // same picture in a still, so the opacities are printed rather than guessed
  // at. The villager's own scale and opacity are printed too: the one thing
  // this motif must never do is let the card be seen leaving.
  const tally = new Map();
  T.arena.scene.traverse((o) => {
    if (!o.name.startsWith('decoy-') || !o.visible) return;
    const a = o.material?.opacity ?? 0;
    if (a <= 0.01) return;
    const e = tally.get(o.name) || { n: 0, hi: 0 };
    e.n++; e.hi = Math.max(e.hi, a);
    tally.set(o.name, e);
  });
  const parts = [...tally].map(([k, v]) => `${k.slice(6)}x${v.n}@${v.hi.toFixed(2)}`);
  const alive = T.pieces.get(villager.uid);
  const card0 = alive
    ? `villager scale ${alive.group.scale.x.toFixed(2)} alpha `
      + `${(alive.frontMat.opacity ?? 1).toFixed(2)}`
    : 'villager retired';
  return `decoy me=${home} ${note} frozen at ${at.toFixed(2)}s`
    + ` — ${parts.join(' ') || 'NOTHING VISIBLE'} — ${card0}`;
})()
