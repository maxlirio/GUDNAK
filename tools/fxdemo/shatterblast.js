// Preview harness for ONE motif: shatterblast.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/shatterblast.js --out /tmp/shatterblast-300.png --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// Extra params:
//   &mag=3       magnify the PICTURE around the blast — a CSS scale on the
//                canvas, not a camera move, so what you see is exactly the
//                pixels the player gets, three times bigger. Narrowing the fov
//                (&zoom) moves the blast to the top of the frame instead,
//                because the camera keeps looking where it was looking.
//   &zoom=2.2    narrow the field of view, for close inspection
//   &seed=7      pin the dice, or two tunings cannot be compared
//   &kill=1      also run the table's real destroy animation on the source and
//                on the four neighbours, which is what the game does
//   &sq=4        which square detonates (4 = centre, all four neighbours)
//   &bare=1      empty the neighbouring squares, to see the ground work
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

  // Pinned BEFORE anything is built, since the motif rolls its own dice.
  const seed = num('seed2', num('fxseed', 7));
  if (seed) {
    let a = (seed * 1831565813) >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);

  // THE CASE THAT MATTERS: the blast in the middle with a fighter on every
  // square it reaches. Anything that only looks right on an empty board is
  // wrong — the neighbours are what this motif is about, and a card covers
  // most of its own flagstone.
  const src = num('sq', 4);
  const me = put(src, 'C053', 0);
  const bare = num('bare', 0);
  const NB = [];
  const r = Math.floor(src / 3), c = src % 3;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = c + dc, nr = r + dr;
    if (nc < 0 || nc > 2 || nr < 0 || nr > 2) continue;
    const sq = nr * 3 + nc;
    NB.push(bare ? null : put(sq, NB.length & 1 ? 'M027' : 'A016', 1));
  }
  // a diagonal, which is NOT adjacent: it must be left alone
  if (!bare && src === 4) put(0, 'A019', 0);

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const zoom = num('zoom', 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  const at = num('t', 0) / 1000;

  // One pass at dt~0 so the new pieces get their materials and contact shadows
  // set up, THEN the cards are frozen. pieces.update() runs after anim.update()
  // every frame and lerps a card back to its resting place at 11/s; with the
  // animator stepped by hand and the page then rendering for another 700ms of
  // WALL clock, that lerp ate the whole blast's shove before the shutter and
  // the cards looked untouched in every screenshot.
  T.pieces.update(0.0001, T.camera);

  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock

  const ev = { kind: 'shatterblast', at: me, faction: 'Shardsworn' };
  T.fx.play(ev);

  const sqOf = (uid) => st.board.findIndex((s) => s.some((c) => c.uid === uid));
  if (num('kill', 0)) {
    // EXACTLY what main.js does, on the same clock: hold the dying cards on
    // the board for the motif's own timing.kill, then hand each one to the
    // motif's exit. Previewing on a board that never loses its cards hides
    // the half of the motif that IS the deaths — which is the whole point of
    // this ability, since it kills five at once.
    const wait = T.fx.killWait([ev]);
    const leave = T.fx.exitFor([ev], 'destroy');
    const dead = [me, ...NB].filter(Boolean);
    T.anim.add(Math.max(0.001, wait), () => {}, () => {
      for (const uid of dead) {
        const piece = T.pieces.get(uid);
        if (!piece) continue;
        const sq = sqOf(uid);
        const retire = () => T.pieces.retire(uid);
        if (leave) leave(piece, sq, retire);
        else T.anim.destroy(piece, sq, retire);
      }
    });
  }

  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  T.pieces.update = () => {};          // hold this exact frame for the camera

  const mag = num('mag', 0);
  if (mag) {
    const cv = T.arena.renderer?.domElement || document.querySelector('canvas');
    const w = cv.clientWidth, h = cv.clientHeight;
    // Centred on the SQUARE, not on the card: with &kill the card has left by
    // the later frames, and a magnifier locked to the piece followed its
    // corpse to the graveyard instead of watching the board.
    const v = T.camera.position.clone()
      .set((src % 3 - 1) * 2.9, 0.2, (1 - Math.floor(src / 3)) * 2.9)
      .project(T.camera);
    cv.style.transformOrigin = `${(v.x * 0.5 + 0.5) * w}px ${(-v.y * 0.5 + 0.5) * h}px`;
    cv.style.transform = `scale(${mag})`;
  }

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
    + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
  hud.textContent = `t+${Math.round(at * 1000)}ms  sq${src}${num('kill', 0) ? ' kill' : ''}`;
  document.body.appendChild(hud);

  return 'played shatterblast frozen at ' + at.toFixed(3) + 's';
})()
