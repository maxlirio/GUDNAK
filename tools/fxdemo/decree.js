// Preview harness for ONE motif: decree.
//
//   node tools/shot.js --url "game/?quick=1&seed=5&t=300" \\
//     --eval tools/fxdemo/decree.js --out /tmp/decree-300.png --settle 900
//
// ?t is MILLISECONDS INTO THE MOTIF. --settle is WALL CLOCK and headless
// rendering runs animation time at a fraction of it, so the animator is taken
// off the frame clock here and stepped by hand to ?t, then frozen. --settle
// then only has to be long enough for Chrome to draw one frame.
//
//   &fxsq=<0-8>  which square the card that spoke is on (default 4, the
//                middle). The motif spreads from there, so the corner and the
//                centre are different pictures and both have to be checked.
//   &fxzoom=2    narrow the field of view for a close look. This motif covers
//                the whole board, so judge it mostly at zoom 1.
//
// Six squares are occupied and three left bare on purpose: the lattice runs
// between the cards, and how it reads over a card and over naked stone are two
// different questions. &fxsq=2, 6 or 8 casts from a BARE square — Hallowed
// Ground names a square and often an empty one, and kit.at answers a different
// height for that, which is a thing that has to be looked at rather than
// reasoned about.
//
// --settle under about 900 is not enough for a cold Chrome on SwiftShader to
// get past the loading screen, and the shot then quietly comes back as the
// GUDNAK splash rather than the board.
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
  const uids = [];
  uids[0] = put(0, 'A019', 0);         // your back row, corner
  uids[1] = put(1, 'A016', 0);         // your Gate
  uids[3] = put(3, 'M027', 1);         // an enemy on the flank
  uids[4] = put(4, 'A016', 0);         // the middle
  uids[5] = put(5, 'M027', 1);
  uids[7] = put(7, 'M066', 1);         // their Gate
  st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
  T.resync();

  const zoom = num('fxzoom', 0);
  if (zoom) { T.camera.fov /= zoom; T.camera.updateProjectionMatrix(); }

  // Which card spoke. Falls back to the square itself when it is empty, since
  // kit.at takes a square index too and the motif must survive that.
  const sq = num('fxsq', 4);
  const source = uids[sq] != null ? uids[sq] : sq;

  const at = num('t', 0) / 1000;
  const real = T.anim.update.bind(T.anim);
  T.anim.update = () => {};            // off the frame clock
  T.fx.play({ kind: 'decree', at: source, faction: 'Gloaming' });
  for (let t = 0; t < at; t += 1 / 120) real(1 / 120);

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;'
    + 'color:#fff;background:#000a;padding:3px 7px;border-radius:3px';
  hud.textContent = 'decree  t=' + Math.round(at * 1000) + 'ms  sq=' + sq;
  document.body.appendChild(hud);
  return 'played decree from sq ' + sq + ' frozen at ' + at.toFixed(2) + 's';
})()
