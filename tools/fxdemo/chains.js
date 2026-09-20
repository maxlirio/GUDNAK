// Preview harness for ONE effect: chains.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=600" \
//     --eval tools/fxdemo/chains.js --out /tmp/ch-600.png --settle 300
//
//   &t=600      freeze the MOTIF 600ms in (see below). Omit it to watch live.
//   &sweep=1    Man Catcher: three cards in the same square, hauled one after
//               another, which is the case that has to hold up.
//   &zoom=26    camera field of view, for a close look at the ironwork.
//
// WHY `t` AND NOT --settle: --settle is wall clock and headless Chrome renders
// this scene at about six frames a second, so a shot taken at --settle 800 was
// really the motif 80ms in and every early screenshot of this effect was of
// the same frame. Instead the harness drives `anim.update` by hand to an exact
// motif time and then stops the animator dead, so `t` is the real timeline.
//
// The effect SHOWS a haul the rules have already carried out, so the harness
// stages it the same way the game does: the victim goes under the captor IN
// STATE and is resynced while its card still stands on its old square on
// screen. Pieces.sync() only places a piece the frame it is created, so an
// existing card keeps its world position and the motif has a real distance to
// drag it over. The old harness left the enemy where it was, which meant
// `dest === held` and there was no haul in the picture at all.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const sweep = q.has('sweep');
  const freeze = q.has('t') ? Number(q.get('t')) / 1000 : 0;

  if (q.has('zoom')) {
    T.camera.fov = Number(q.get('zoom'));
    T.camera.updateProjectionMatrix();
  }

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq].push({ uid: u, def, owner: own, fatigued: false, attachments: [] });
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const me = put(3, 'A016', 0);                  // the captor, middle row left
  // real def ids only: an unknown one builds a Piece with no art at all and
  // the card renders as a blank brown slab, which looked for a while like the
  // effect was flipping cards over
  if (sweep) { put(5, 'M027', 1); put(5, 'M017', 1); put(5, 'M023', 1); }
  else put(5, 'M027', 1);
  const foes = st.board[5].map((c) => c.uid);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();                                    // cards born on their squares

  // now the rules "resolve": every victim ends up under the captor
  st.board[3] = [...st.board[3], ...st.board[5]];
  st.board[5] = [];
  T.resync();

  // All of them in one frame, which is how a Man Catcher sweeping a square
  // fires: the effect spaces the cards out itself, and staggering the calls
  // here on top of that would have measured a cadence the game never has.
  foes.forEach((uid) => T.fx.play({ kind: 'chains', from: me, to: uid }));
  if (!freeze) return `played ${foes.length} live`;

  // Step to the wanted moment, then take the animator's clock away so the
  // render loop cannot creep past it while the screenshot is being taken.
  const STEP = 1 / 120;
  for (let c = 0; c < freeze; c += STEP) T.anim.update(STEP);
  T.anim.update = () => {};
  return `froze at ${freeze}s, ${foes.length} chain(s)`;
})()
