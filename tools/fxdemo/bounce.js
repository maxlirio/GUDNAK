// Preview harness for ONE motif: bounce.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \
//     --eval tools/fxdemo/bounce.js --out /tmp/bounce-300.png --settle 700
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
// Other params:
//   &van=1     ALSO run anim.vanish() on the card and retire it, which is what
//              the real table does: playAnimations() starts the card on its
//              400ms arc to the owner before state.fx is played at all. The
//              motif then never gets to touch the card, and this is the only
//              honest way to look at it. &van=0 (the default) leaves the card
//              on the square, which is the fxlab case, where the motif does
//              own the fade.
//   &zoom=2.2  narrow the field of view for looking at the motes close up
//   &foe=1     bounce the ENEMY fighter instead, so the departure runs away
//              from the camera rather than toward it. NOT &side — the game
//              itself takes ?side as "pretend to be the online guest", and
//              using that name here quietly turned the whole table around.
//   &seed=7    pin the dice — every mote's speed, birth and life is rolled, so
//              two tunings are otherwise not comparable
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
  const me = put(3, 'A016', 0);        // your fighter, centre-left
  const foe = put(5, 'M027', 1);       // an enemy, centre-right
  const friend = put(1, 'A019', 0);    // a second fighter of yours
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  // Pinning the dice: the motif rolls every mote, so without this two
  // screenshots of two tunings differ for reasons that have nothing to do with
  // the change being judged.
  const seed = num('seed', 0);
  if (seed) {
    let a = (seed * 1831565813) >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const zoom = num('zoom', 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
    + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
  document.body.appendChild(hud);

  const uid = num('foe', 0) ? foe : me;
  // ORDER MATTERS and it is the table's order, not a convenience: sync() runs
  // playAnimations() first and plays state.fx after, so the card is already
  // flying home by the time the motif starts.
  if (num('van', 0)) {
    const piece = T.pieces.get(uid);
    if (piece) T.anim.vanish(piece, () => T.pieces.retire(uid));
  }
  T.fx.play({ kind: 'bounce', at: uid, faction: 'Shardsworn' });

  const at = Number(q.get('t') || 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);
  hud.textContent = `bounce t+${Math.round(at * 1000)}ms${num('van', 0) ? ' vanish' : ''}`;
  // The piece is named in the return value on purpose: kit.at() falls back to
  // treating a number under 12 as a SQUARE, so a uid the pieces map has lost
  // silently moves the whole motif to another flagstone. Twice I chased that
  // as an effect bug when it was the preview.
  return `bounce at uid ${uid}, piece ${T.pieces.get(uid) ? 'found' : 'MISSING'}, frozen at ${at.toFixed(2)}s`;
})()
