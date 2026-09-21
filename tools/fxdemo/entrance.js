// Preview harness for ONE motif: entrance.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=900" \\
//     --eval tools/fxdemo/entrance.js --out /tmp/en-900.png --settle 600 --wait 8000
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// --wait is the other one. The board takes several seconds to raise under
// SwiftShader and longer again with other shots running beside it; too short
// and this throws on window.__table, which reads as "the effect is broken"
// when the page simply had not booted. So it POLLS rather than assuming.
//
// THE RADIUS IS THE SUBJECT, so the default staging is built to prove it. The
// Bards stand at square 3 — the middle of the left file — because the reach
// counts along the grid's own orthogonal adjacency (Manhattan), and from an
// EDGE square two of the nine are out of range. Cast from the centre every
// square is within two and there is no boundary to photograph at all.
//
//   sq 3  the Bards (yours)          sq 0,4  enemies at one square   IN
//   sq 1  an enemy at two squares    IN, and the last square in
//   sq 5  an ENEMY BARDS-FOR-HIRE    IN range and immune — the joke
//   sq 6,7 your own fighters         IN range and untouched
//   sq 2,8 enemies at three squares  OUT — they must stay lit
//
// Knobs:
//   &none=1   no enemies at all — the case the motif must not throw on
//   &noband=1 no rival bards, for judging the field without the joke in it
//   &sq=1     cast from a bare square (a fighter that is not there yet)
//   &fov=20   narrow the camera for a close look at one victim
//   &look=3   centre the view on a square (default 4, the middle of the grid)
//   &high=6   lift the camera, for a flatter read of the field on the stone
(async () => {
  // POLL. The machine runs several of these at once and the board takes a
  // variable few seconds to raise under SwiftShader; reading window.__table
  // straight off threw on a page that had simply not booted yet, and a shot of
  // the loading screen looks exactly like a motif that does not draw.
  const T = await (async () => {
    for (let i = 0; i < 200; i++) {
      if (window.__table?.state && window.__table.fx) return window.__table;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('window.__table never appeared');
  })();
  const st = T.state;
  const q = new URLSearchParams(location.search);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);

  const me = put(3, 'R092', 0);              // the band itself
  if (!q.has('none')) {
    put(4, 'M027', 1);                       // one square away
    put(0, 'C049', 1);                       // one square away
    put(1, 'M015', 1);                       // two squares — the edge of reach
    put(2, 'M017', 1);                       // THREE squares — out of reach
    put(8, 'M020', 1);                       // three squares — out of reach
    if (!q.has('noband')) put(5, 'R092', 1); // rival bards: they play along
  }
  put(6, 'A016', 0);                         // yours, in range, untouched
  put(7, 'A019', 0);

  if (q.has('fov')) { T.camera.fov = Number(q.get('fov')); T.camera.updateProjectionMatrix(); }

  // RE-AIM. The game aims at (0, 0.2, 3.4) — biased toward the near stronghold
  // so the player's own hand has room — which parks the top row of squares
  // under the HUD banner. Every shot of square 0/1/2 was a card behind the
  // words "Bolts of Destruction". placeCamera() runs EVERY frame, so this
  // cannot just set the camera once: it wraps position.set and lookAt so the
  // re-aim is re-applied after the game has had its say.
  {
    const sq = Number(q.get('look') ?? 4);
    const target = new (T.camera.position.constructor)(
      ((sq % 3) - 1) * 2.62, 0.2, (1 - Math.floor(sq / 3)) * 2.62);
    const P = T.camera.position;
    const set = P.set.bind(P);
    P.set = (x, y, z) => set(x, y + Number(q.get('high') || 0), z);
    const aim = T.camera.lookAt.bind(T.camera);
    T.camera.lookAt = () => aim(target.x, target.y, target.z);
  }

  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};                  // off the frame clock
  T.fx.play({ kind: 'entrance', at: q.has('sq') ? 3 : me, faction: 'Neutral' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return 'played entrance frozen at ' + at.toFixed(2) + 's';
})()
