// Preview harness for ONE motif: lashout — the shot AND what becomes of the
// card it kills, because those are one event and have to be looked at as one.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \
//     --eval tools/fxdemo/lashout.js --out /tmp/lashout-300.png --settle 1400
//
// ?t is MILLISECONDS from the moment the motif starts — not from the moment
// the card starts leaving. --settle is WALL CLOCK and headless rendering runs
// animation time at a fraction of it, so the animator is taken off the frame
// clock here and stepped by hand to ?t, then frozen. --settle then only has to
// be long enough for Chrome to draw one frame.
//
// The motif is in two halves that meet in the middle — the draw, then the
// lance fired by the victim's own exit — so this runs them on exactly the
// clock main.js does: play, wait fx.killWait(), hand the card to fx.exitFor().
//
//   ?me=3&foe=5   two apart across the middle row  (the Cannoneer's range)
//   ?me=0&foe=8   four apart on the long diagonal  (the Ranger's)
//   ?me=3&foe=4   next door                        (the Cavalry's)
//   ?me=7&foe=1   straight down the board, at the camera
//   ?nokill=1     the ability fizzled, or the effects lab: nothing dies, and
//                 the draw has to fire the lance itself at its own guess
//   ?solo=1       no enemy on the board at all — the blind fallback
//   ?crowd=1      other enemies, nearer than the victim: the case that decides
//                 whether the motif shoots the card that actually died
//   ?faction=Shardsworn   the other two owners of this motif
//   ?zoom=14      narrows the lens onto the two squares involved; ?look=foe or
//                 ?look=me puts it on one of them. The board is played at 60
//                 pixels a card and that is what the motif has to read at, so
//                 a zoomed frame is for FINDING faults — depth fighting, a
//                 crack lying on the stone instead of the card — and never for
//                 judging whether the thing reads.
//
// The board lays out row 0 (squares 0,1,2) nearest the camera.
//
// Everything below waits for the table to exist first. main.js finishes
// booting behind a top-level await, and on a loaded machine — several of these
// running at once while other motifs are being worked on — that can take
// longer than any --settle worth waiting: the harness then threw on a
// `window.__table` that was not there yet and the screenshot was the loading
// screen. shot.js awaits whatever the snippet returns, so waiting here is free.
(async () => {
  for (let i = 0; i < 400 && !window.__table; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const T = window.__table, st = T.state;
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
  const put = (sq, def, own) => {
    const u = ++st.nextUid;
    st.board[sq] = [{ uid: u, def, owner: own, fatigued: false, attachments: [] }];
    return u;
  };
  st.board = Array.from({ length: 12 }, () => []);
  const mySq = num('me', 3);
  const foeSq = num('foe', 5);
  const me = put(mySq, 'A016', 0);                    // the shooter
  const foe = q.has('solo') ? null : put(foeSq, 'M027', 1);

  // Bystanders, because the line has to be legible when it crosses a busy
  // board and not only over bare stone. Friendly by default; with ?crowd=1 two
  // of them turn enemy, which is what tests that the motif shoots the card the
  // rules actually killed rather than the nearest thing it can see.
  const crowd = q.has('crowd');
  for (const [sq, def, own] of [[1, 'A019', 0], [7, 'M031', crowd ? 1 : 0],
    [2, 'M029', crowd ? 1 : 0]]) {
    if (sq !== mySq && sq !== foeSq) put(sq, def, own);
  }
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // A tighter lens, for looking closely. placeCamera() runs every frame and
  // re-aims at the near row, so the target has to be patched in rather than
  // set once, or the next frame throws it away.
  if (q.has('zoom')) {
    const a = T.pieces.get(me).group.position;
    const b = (foe && T.pieces.get(foe)?.group.position) || a;
    const c = q.get('look') === 'foe' ? b : q.get('look') === 'me' ? a : null;
    const mid = c ? { x: c.x, y: 0.2, z: c.z }
      : { x: (a.x + b.x) / 2, y: 0.2, z: (a.z + b.z) / 2 };
    const orig = T.camera.lookAt.bind(T.camera);
    T.camera.lookAt = () => orig(mid.x, mid.y, mid.z);
    T.camera.fov = num('zoom', 14);
    T.camera.updateProjectionMatrix();
  }

  const at = num('t', 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock

  const ev = { kind: 'lashout', at: me, faction: q.get('faction') || 'Marvorren' };
  T.fx.play(ev);

  // Exactly what main.js does: the victim stays on the table for the motif's
  // own kill time, and then whoever showed HOW it died owns its leaving. The
  // exit lands two frames before the motif's own fallback would, which is how
  // the fallback knows the shot has already been taken.
  const wait = T.fx.killWait([ev]);
  if (foe != null && !q.has('nokill')) {
    const piece = T.pieces.get(foe);
    T.anim.add(wait, () => {}, () => {
      T.fx.exitFor([ev], 'destroy')(piece, foeSq, () => T.pieces.retire(foe));
    });
  }

  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  return `lashout + exit, kill wait ${wait}s, frozen at ${at.toFixed(2)}s`;
})()
