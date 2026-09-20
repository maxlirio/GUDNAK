// Preview harness for ONE effect: shardfire.
//
//   node tools/shot.js --url "game/?quick=1&seed=5" \
//     --eval tools/fxdemo/shardfire.js --out /tmp/shardfire-400.png --settle 400
//
// --settle is WALL CLOCK, and it is nearly useless here: headless Chrome
// throttles requestAnimationFrame to a few frames a page, and dt is clamped to
// 50ms a frame, so the table's animation clock stalls around t+150ms no matter
// how long you wait. Shots at --settle 160 and --settle 800 came back at the
// same animation time and the motif looked frozen.
//
// So this harness DRIVES the clock: &fxat=0.40 steps the animator by hand in
// 1/60s slices to exactly 400ms and then freezes it, and the corner readout
// says which frame you are looking at. --settle only needs to be long enough
// for one render (300 is plenty).
//
// Extra URL params this harness understands:
//   &fxat=0.40    step to exactly 400ms of animation time, then freeze
//   &fxzoom=2.2   narrow the camera's field of view, for close inspection
//   &fxchain=5    fire five blasts down the board instead of one
//   &fxgap=0.25   animation-seconds between them (Lay Waste spaces deaths out)
//   &fxseed=7     pin the dice, so two tunings can actually be compared
//   &fxkill=0     leave the corpse on the board (it is thrown off by default)
//
// The blast fires AND the fighter is destroyed on the same frame, because that
// is the order sync() does it in: playAnimations() throws the corpse at the
// graveyard and then state.fx is played. Previewing the effect on a board that
// never loses its card hides half of what it has to survive.
//
// This file is yours to change while you work on that effect.
(() => {
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  // The real ability passes a UID — the card that is dying is still on the
  // table when the fire goes off — so the harness does too.
  const me = put(3, 'A016', 0);        // your fighter, centre-left
  const foe = put(5, 'M027', 1);       // an enemy, centre-right
  const friend = put(1, 'A019', 0);    // a second fighter of yours
  const far = put(6, 'A016', 1);
  const near = put(8, 'M027', 0);
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // Every blast jitters its own size, phase, tongue count and heights, which is
  // the point of the motif but makes two screenshots of two different tunings
  // impossible to compare — twice I "fixed" something that was really just a
  // different roll. &fxseed pins the dice for the preview only.
  const seed = num('fxseed', 0);
  if (seed) {
    let a = (seed * 1831565813) >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const zoom = num('fxzoom', 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  // Animation-time readout, so every screenshot says when it was taken.
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
    + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
  document.body.appendChild(hud);

  const squares = [foe, me, near, friend, far, foe];
  const n = num('fxchain', 1);
  const gap = num('fxgap', 0.25);
  // The corpse is thrown off to the graveyard over 620ms, which is what
  // uncovers the stone the fire was standing on — so the preview has to do it
  // too or the scorch is hidden under a card that never leaves and you cannot
  // see the half of the motif that outlives the blast. &fxkill=0 turns it off.
  const kill = num('fxkill', 1);
  const sqOf = (uid) => st.board.findIndex((s) => s.some((c) => c.uid === uid));
  const fire = (i) => {
    const uid = squares[i % squares.length];
    T.fx.play({ kind: 'shardfire', at: uid });
    const piece = kill && T.pieces.get(uid);
    // ...and it is RETIRED at the end of that throw, as the real table does.
    // Left on the board it parks on top of its own square and hides the burn,
    // which made the last second of the motif look like nothing happened.
    if (piece && !piece.animating) {
      T.anim.destroy(piece, sqOf(uid), () => T.pieces.retire(uid));
    }
    if (i + 1 < n) T.anim.add(gap, () => {}, () => fire(i + 1));
  };
  fire(0);

  const at = num('fxat', 0);
  if (at) {
    const step = 1 / 60;
    for (let s = 0; s < at; s += step) T.anim.update(Math.min(step, at - s));
    T.anim.update = () => {};              // hold this exact frame for the camera
  }
  hud.textContent = `t+${Math.round(at * 1000)}ms  x${n}`;
  return `fired ${n} at gap ${gap}, held at ${at}s`;
})()
